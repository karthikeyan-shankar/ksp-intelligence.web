# KSP Crime Intelligence Platform

An intelligent conversational AI platform built for the Karnataka State Police (KSP) to enable investigators, analysts, and officers to query crime data, analyze suspect networks, and track district-level trends using natural language.

---

## 1. Prototype Brief

### Problem Statement Addressed
Currently, police investigators and data analysts face challenges when navigating complex, traditional relational databases to extract actionable insights. Querying crime trends, mapping suspect networks, or finding specific FIR details often requires writing complex SQL queries or relying on rigid dashboard filters. This slows down investigations and decision-making.

### Key Features and Functionalities
*   **Conversational AI Interface**: Officers can type natural language questions (e.g., "Show me recent thefts in Bengaluru Urban") which the system translates into SQL queries to fetch immediate answers.
*   **Official Database Schema Compliance**: Implements the official 26-table Karnataka Police Department ER schema (incorporating entities like `CaseMaster`, `ComplainantDetails`, `Accused`, `CrimeHead`, `ActSectionAssociation`, etc.).
*   **Real-time Dashboard Metrics**: Dynamic visualization of KPI stats, crime type distributions, and district-wise incident numbers.
*   **Suspect Network Analysis**: Built-in capability to analyze and map connections between repeat offenders based on co-occurrences in FIRs.
*   **Secure Access**: Role-based access control (Admin, Superintendent, Inspector, Analyst) with a highly secure, restricted-access government UI theme.

### Technology Stack Used
*   **Backend**: Node.js, Express.js
*   **Database**: SQLite3 (using `better-sqlite3` for high performance)
*   **Frontend**: HTML5, CSS3 (Glassmorphism design, Inter & Roboto Mono fonts), Vanilla JavaScript
*   **AI Engine Hook**: Modular `ai-engine.js` designed for direct LLM API integration.

### Proposed Impact and Use Case
This platform empowers law enforcement officers of all technical skill levels to interact directly with the state's crime database. By removing the technical barrier of SQL and legacy UI navigation, the platform dramatically reduces the time needed to extract critical intelligence, identify criminal networks, and generate actionable reports, ultimately leading to faster case resolutions and better resource allocation.

---

## 2. Setup and Execution Instructions

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16 or higher)
*   Git

### Local Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/karthikeyan-shankar/ksp-intelligence.web.git
   cd ksp-intelligence.web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Setup:**
   The application features an auto-seeding mechanism. When the server starts for the first time, it will automatically build the official 26-table schema and populate it with realistic mock data if the database is empty.
   *(Optional)* To manually re-seed the database:
   ```bash
   npm run seed
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Access the application:**
   Open your browser and navigate to: `http://localhost:3000`

### Demo Credentials
Use any of the following accounts to access the platform:
*   **Admin**: `admin` / `admin`
*   **Superintendent**: `sp_blr` / `police123`
*   **Inspector**: `inspector` / `inspect123`
*   **Data Analyst**: `analyst` / `data123`

---

## 3. Zoho Catalyst Deployment Guide

This project is prepared for deployment on **Zoho Catalyst** using **AppSail**.

1. Install the Catalyst CLI:
   ```bash
   npm install -g zcatalyst-cli
   ```
2. Log in to your Catalyst account:
   ```bash
   catalyst login
   ```
3. Initialize the project:
   ```bash
   catalyst init
   ```
   *Select **AppSail** when prompted, and configure the source folder to the current directory.*
4. Deploy the application:
   ```bash
   catalyst deploy
   ```

*Note: The SQLite database file (`ksp_crime.db`) will be initialized automatically in the deployed environment upon the first startup.*
