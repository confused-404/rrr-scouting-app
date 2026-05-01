# RRR Scouting App

Full-stack scouting platform used by an FRC team to collect, analyze, and export match data in real time during competition.

## Impact

* Used in live strategy workflows for Red Rock Robotics
* Has supported roughly 20 concurrent users during competition, can handle many more
* Runs for a worldwide top 150 team out of 3724 teams
* Supports the #1 ranked team in Utah for strategy and match preparation

## Why we built this

Competitive robotics teams rely on fast, accurate match data to make strategy decisions. Existing tools were either too slow or not tailored to our workflow, so we built a custom system used by Red Rock Robotics.

## Features

* Real-time match data entry from multiple scouts
* Centralized storage and aggregation of scouting data
* Data visualization and filtering for match strategy
* Export tools for alliance selection and scouting reports
* Designed for reliability in competition environments (multiple devices, unstable Wi-Fi)

## Usage

Used by Red Rock Robotics during official FRC competitions.

* Supports multiple simultaneous scouts
* Handles full match scouting workflow end-to-end
* Powers drive team prep, pit notes, and live match strategy

## Tech Stack

* Frontend: React (Vite)
* Backend: Node.js + Express
* Database/Auth/Storage: Firebase

## Architecture

Scouts → frontend (data entry) → backend API → database → aggregation → visualization/export

---

## Development

### Quick Start

```bash
# Terminal 1 - Backend
cd backend
npm i
npm run dev

# Terminal 2 - Frontend
cd frontend
npm i
npm run dev
```

Backend runs on `http://localhost:3001` (or `$PORT`)
Frontend runs on `http://localhost:3000`

### Setup Environment Variables

Create `.env` files in each directory using `.env.example` as a template:

```bash
# Backend
cd backend && cp .env.example .env

# Frontend
cd frontend && cp .env.example .env.local
```

---

## Notable Implementation Details

* Handles concurrent submissions from multiple clients
* Structured data model for efficient querying and export
* Direct image uploads from frontend to Firebase Storage
* Password reset flow using SMTP or API-based email providers
* Cache-backed upstream integrations for event and team data

---

## Project Structure

```bash
.
├── backend/          # Express API
│   ├── src/
│   ├── vercel.json
│   └── .env.example
├── frontend/         # React + Vite
│   ├── src/
│   ├── vercel.json
│   └── .env.example
```

---

## Credits

Built collaboratively with another contributor. I led core development and system design, with significant contributions across the stack.
