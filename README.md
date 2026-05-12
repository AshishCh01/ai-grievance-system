# Grievance System

Hackathon-ready AI citizen grievance classification system.

## Main Features
- Citizen registration and login
- Officer login with department-based access
- Admin seeding for department-wise officers
- AI grievance classification, summary, priority, sentiment, duplicate detection
- File upload support with Cloudinary fallback to local storage
- PostgreSQL storage
- JWT authentication
- SMS notifications via Twilio
- Mobile-friendly dashboard UI

## Default Officer Accounts
All officers are seeded automatically on first run.

Password for every seeded officer:
`Officer@12345`

Admin account:
- Email: `admin@example.com`
- Password: `Admin@12345`

## Setup

### Backend
```bash
cd backend
pip install -r ../requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database
Use PostgreSQL database named `ai_grievance`.

### OpenAI
Leave `OPENAI_API_KEY` blank until hackathon day.
The project automatically falls back to local AI logic if the key is missing.
