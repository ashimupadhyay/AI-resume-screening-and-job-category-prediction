import io
import os
import re
from datetime import date, datetime, timedelta, timezone

import bcrypt
import docx
import joblib
import pdfplumber
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from pathlib import Path
from pydantic import BaseModel, EmailStr

from database import get_connection


app = FastAPI(
    title="Resume Screening API",
    description="React + FastAPI + MySQL: login, signup and resume screening",
    version="1.0.0",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------
# The origins below are the addresses the React page can run from:
#   5173 / 3000 -> npm run dev   |   plain localhost -> XAMPP htdocs (port 80)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "resume_screening_model.pkl"

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

MAX_BYTES = 5 * 1024 * 1024  # 5 MB resume limit


# --------------------------------------------------
# LOAD SAVED ML ARTIFACTS (once, when the server starts)
# --------------------------------------------------

artifacts = joblib.load(MODEL_PATH)

model = artifacts["model"]
tfidf = artifacts["tfidf"]
categories = artifacts["categories"]


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    dob: date
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# --------------------------------------------------
# VALIDATION ERRORS -> one readable message
# --------------------------------------------------
# FastAPI normally returns a list of error objects, which the React page
# cannot display. This turns it into a plain text message.

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    fields = {str(part) for err in exc.errors() for part in err.get("loc", ())}

    if "email" in fields:
        message = "Enter a valid email address."
    elif "dob" in fields:
        message = "Enter a valid date of birth."
    elif "resume" in fields:
        message = "Choose a resume file to upload."
    else:
        message = "Some details are missing or invalid. Check them and try again."

    return JSONResponse(status_code=422, content={"detail": message})


# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "Resume Screening API is running"
    }


# --------------------------------------------------
# SIGNUP
# --------------------------------------------------

@app.post("/signup")
def signup(user: SignupRequest):

    connection = None
    cursor = None

    try:

        # Validate password
        if len(user.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must contain at least 6 characters."
            )

        # bcrypt only accepts up to 72 bytes
        if len(user.password.encode("utf-8")) > 72:
            raise HTTPException(
                status_code=400,
                detail="Password is too long. Use 72 characters or fewer."
            )

        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Check whether email already exists
        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email = %s
            """,
            (user.email,)
        )

        existing_user = cursor.fetchone()

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email is already registered."
            )

        # Hash password
        hashed_password = bcrypt.hashpw(
            user.password.encode("utf-8"),
            bcrypt.gensalt()
        )

        # Insert user
        cursor.execute(
            """
            INSERT INTO users
            (
                first_name,
                last_name,
                dob,
                email,
                password
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                user.first_name,
                user.last_name,
                user.dob,
                user.email,
                hashed_password.decode("utf-8")
            )
        )

        connection.commit()

        return {
            "message": "Account created successfully."
        }

    except HTTPException:
        raise

    except Exception as e:
        print("Signup error:", e)

        raise HTTPException(
            status_code=500,
            detail="Something went wrong while creating the account."
        )

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@app.post("/login")
def login(user: LoginRequest):

    connection = None
    cursor = None

    try:

        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Find user
        cursor.execute(
            """
            SELECT
                id,
                first_name,
                last_name,
                dob,
                email,
                password,
                created_at
            FROM users
            WHERE email = %s
            """,
            (user.email,)
        )

        db_user = cursor.fetchone()

        if not db_user:

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password."
            )

        # Check password
        password_valid = bcrypt.checkpw(
            user.password.encode("utf-8"),
            db_user["password"].encode("utf-8")
        )

        if not password_valid:

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password."
            )

        # JWT expiration
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

        token_data = {
            "sub": str(db_user["id"]),
            "email": db_user["email"],
            "exp": expire
        }

        access_token = jwt.encode(
            token_data,
            SECRET_KEY,
            algorithm=ALGORITHM
        )

        return {
            "message": "Login successful",

            "access_token": access_token,

            "token_type": "bearer",

            "user": {
                "id": db_user["id"],
                "first_name": db_user["first_name"],
                "last_name": db_user["last_name"],
                "email": db_user["email"]
            }
        }

    except HTTPException:
        raise

    except Exception as e:
        print("Login error:", e)

        raise HTTPException(
            status_code=500,
            detail="Something went wrong during login."
        )

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# --------------------------------------------------
# RESUME SCREENING
# --------------------------------------------------

def extract_text(filename: str, data: bytes) -> str:

    name = filename.lower()

    if name.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        return re.sub(r"\(cid:\d+\)", " ", text)  # remove PDF bullet noise

    if name.endswith(".docx"):
        d = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in d.paragraphs)

    if name.endswith(".txt"):
        return data.decode("utf-8", errors="ignore")

    raise HTTPException(
        400,
        "Upload a PDF, DOCX or TXT file"
    )


@app.get("/job-fields")
def get_job_fields():

    return {
        "job_fields": [str(c) for c in categories]
    }


@app.post("/screen")
async def screen(resume: UploadFile = File(...)):

    # Read uploaded resume
    data = await resume.read()

    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is larger than 5MB")

    # Extract text
    text = extract_text(resume.filename or "", data)

    if len(text.strip()) < 50:
        raise HTTPException(
            400,
            "Could not read enough text from the resume"
        )

    # Convert text to TF-IDF
    resume_tfidf = tfidf.transform([text])

    # Get probabilities for all categories
    probabilities = model.predict_proba(resume_tfidf)[0]

    # Sort from highest to lowest
    top_indices = probabilities.argsort()[::-1][:5]

    # Create Top 5 result
    top_predictions = []

    for index in top_indices:

        top_predictions.append({
            "job_field": str(categories[index]),
            "confidence": round(
                float(probabilities[index]),
                4
            )
        })

    return {
        "filename": resume.filename,
        "predicted_job_field": top_predictions[0]["job_field"],
        "confidence": top_predictions[0]["confidence"],
        "top_predictions": top_predictions
    }