# Walk-In Tutor

**Learn Nearby. Teach Nearby. Earn Nearby.**

Walk-In Tutor is a web platform that connects college students who want part-time teaching work with parents and students looking for affordable tutors nearby. Tutors create a profile, parents search by subject, class or area, and request a demo class before deciding.

- **Author:** Manaswi Srivastava
- **Roll No / Course:** 18 / BCA 3rd Year
- **College:** DNPG

Features
Search tutors by subject, class and area
Sign up and log in with a real account (passwords are hashed)
Two account types: Student / Parent (looks for tutors and requests demos) and Tutor (creates a profile and receives requests). The type is chosen at signup.
Create a tutor profile (Tutor accounts only, one profile per account)
Request a demo class with a tutor (Student / Parent accounts only)
10-digit Indian mobile numbers (+91) with validation on both browser and server
Interactive map (OpenStreetMap) showing each tutor's approximate area (about 1 km), never an exact address
"Show distance from me" to see how far each tutor roughly is and sort by nearest
Students share an approximate location (about 1 km) with every demo request
Tutors and students can edit their own details: a tutor edits the whole tutor profile (including the map location), and every user can change their name and password (changing the password logs out other devices)
Demo completion and reviews: after a demo the tutor marks it as completed, and only then can that student rate the tutor from 1 to 5 stars with an optional written review. Tutor cards show the average rating, and clicking it lists the reviews
My Requests page for tutors: all demo requests for their profile, with the student's phone number, class, message and approximate area on a map
Walk-In AI chat assistant: understands messages like "Maths tutor for class 8 under ₹1500", searches the live tutor list and shows the matching tutors with Request demo and Reviews buttons. It remembers the filters for follow-up messages ("under 1900", "nearest first") and answers common questions about demos, ratings, privacy, payments and becoming a tutor
Responsive landing page
Tech Stack
Part	Technology
Frontend	HTML, CSS, JavaScript (no framework)
Maps	Leaflet + OpenStreetMap tiles (no API key)
Backend	Node.js, Express
Database	MongoDB (via Mongoose)
Security	bcryptjs (password hashing), session cookies
Project Structure
walkintutorrr/
├── README.md
├── .gitignore
├── backend/
│   ├── server.js          # Express server and all API routes
│   ├── models.js          # MongoDB schemas (Tutor, User, Session, DemoRequest)
│   ├── show-requests.js   # Prints demo requests in the terminal
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example       # Template for the .env file
└── frontend/
    ├── index.html
    ├── style.css
    ├── script.js
    ├── chatbot.js         # Logic of the chat assistant (searches the tutor list)
    └── logo.jpeg

The Express server also serves the frontend folder, so only one server needs to run.

How to Run
Requirements
Node.js version 20 or newer (LTS recommended) - https://nodejs.org
An internet connection (needed to load the map and map tiles)
MongoDB, either:
MongoDB Community Server installed locally and running (simplest, no account needed), or
a free MongoDB Atlas cluster (see below)
Steps

Open a terminal inside the backend folder and run:

bash
npm install

Create your .env file from the template:

bash
# Windows (Command Prompt or PowerShell)
copy .env.example .env

# Mac / Linux
cp .env.example .env

The template already points to a local MongoDB (mongodb://127.0.0.1:27017/walkintutor), so if MongoDB is installed and running, no edit is needed. Then start the server:

bash
npm start

You should see:

Connected to MongoDB
Added 4 sample tutors to the database
Server running at http://localhost:3000

Open http://localhost:3000 in the browser. Always use this address (do not open index.html by double-clicking, because the page needs the server).

On the very first run, 4 sample tutors are added to the database automatically.

Using MongoDB Atlas instead of a local database
Create a free cluster on https://www.mongodb.com/atlas
Add a database user (letters and numbers only in the password) and, under Network Access, allow your IP address.
Copy the connection string from Connect > Drivers > Node.js, replace <password>, and add the database name walkintutor after .net/:
MONGO_URL=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/walkintutor?retryWrites=true&w=majority
Put this line in backend/.env and run npm start.

The .env file contains secrets. It is not included in the submission and must never be uploaded to GitHub.

Viewing Demo Requests

Demo requests contain phone numbers, so they are never shown on the public website. A tutor sees the requests for their own profile after logging in and clicking My Requests in the navigation bar. As the project owner you can also list all requests from a second terminal in the backend folder:

bash
node --env-file=.env show-requests.js

You can also browse all collections visually with MongoDB Compass (local) or Browse Collections (Atlas).

API Endpoints
Method	Route	Who can use	Purpose
POST	/api/signup	No	Create an account (role: student or tutor)
POST	/api/login	No	Log in
POST	/api/logout	No	Log out
GET	/api/me	No	Who is logged in right now
GET	/api/tutors	No	List all tutors (public fields)
POST	/api/tutors	Tutor	Create the logged-in tutor's profile
POST	/api/demo-requests	Student	Request a demo with a tutor
GET	/api/my-profile	Tutor	Read the tutor's own profile (to edit it)
PUT	/api/my-profile	Tutor	Update the tutor's own profile
PUT	/api/account	Logged in	Change the account name
PUT	/api/account/password	Logged in	Change the password
POST	/api/demo-requests/:id/complete	Tutor	Mark a demo as completed (own requests only)
GET	/api/my-demos	Student	The student's demo requests and ratings
POST	/api/reviews	Student	Rate a tutor (after a completed demo)
GET	/api/tutors/:id/reviews	No	Public reviews of a tutor
GET	/api/my-requests	Tutor	Demo requests received by the logged-in tutor's profile
Database Collections
Collection	Stores
tutors	Tutor profiles (name, subjects, area, classes, fees, owner)
users	Accounts (name, email, password hash)
sessions	Login sessions (hashed token, auto-deleted after 7 days)
reviews	Ratings and comments (tutor, student account, 1-5 stars)
demorequests	Demo requests (tutor, account, student name, phone, class, approximate location)
Security Measures
Passwords are hashed with bcrypt; the real password is never stored.
Login uses a random session token in an httpOnly, SameSite cookie; only a hash of the token is stored in the database.
Repeated wrong passwords are blocked temporarily (5 attempts per 15 minutes).
Role-based access: the server checks the account type on every protected route, so a Student account cannot create a tutor profile or read tutor requests, and a Tutor account cannot send demo requests, even if someone bypasses the buttons in the browser.
All input is validated on the server as well as in the browser (email, phone, fees, classes, text length).
Tutor email and phone numbers are never sent to the public tutor list.
Location privacy: a tutor's exact location is never stored. The browser rounds the chosen point to a grid of about 1 km (2 decimal places) before sending, the server rounds it again, and the map shows a 1 km circle instead of a pin. The rounding moves a point by at most about 0.8 km, so the circle always contains the real spot.
A visitor's own location ("Show distance from me") stays in their browser and is never sent to the server.
A student's location in a demo request is rounded to ~1 km in the same way. Only the tutor who received the request can see it, through My Requests; other users and the public tutor list never receive it.
A student's phone number is visible only to the tutor they requested a demo with, so the tutor can contact them.
Text shown on the page is escaped to prevent script injection (XSS).
Duplicate tutor profiles and duplicate demo requests are rejected.
Reviews cannot be faked: a student can rate a tutor only after that tutor marked the student's demo as completed, and each student can have only one review per tutor (sending it again updates it). Rating, review count, verified badge, email and owner can never be changed through the profile form, so a tutor cannot raise their own rating.
Review text is displayed as plain text, and only the reviewer's first name is shown publicly.
Notes and Limitations
The 4 starting tutors, their ratings and review counts are sample data for demonstration.
The hero card at the top of the page is a static design element.
Accounts created before account types existed are given a type automatically on server start (accounts that own a tutor profile become Tutor accounts, the rest become Student accounts).
The ratings and review counts of the 4 sample tutors are demo numbers, not real student reviews (they have no accounts, so they cannot complete demos or be rated).
The 4 sample tutors have no account, so nobody can open My Requests for them (requests sent to them are visible only through show-requests.js). To try the full flow, create one Tutor account and one Student account.
The 4 sample tutors have approximate coordinates based on their area names (one has no location, so it does not appear on the map). Tutors who register get their location from the map picker.
Distances are approximate straight-line distances to the tutor's ~1 km area, not driving distances.
The chat assistant is rule-based, not a language model: it understands the kinds of messages it was built for (subject, class, area, budget, ordering and a set of common questions). This keeps it free, fast and independent of any external service or API key. It only uses public tutor data, never phone numbers or emails. A language-model assistant could be added later, with this one as the fallback.
New tutor profiles are not verified automatically (no "Verified" badge until reviewed).
Future Improvements
Admin page to view demo requests and verify tutors
Let a tutor reply to reviews, and report fake reviews
Optional language-model chat assistant (needs an API key), using the current assistant as a fallback
Notify tutors by SMS or email when a demo is requested
Password reset, and email/phone verification (OTP)
Real reviews and ratings from students
Location-based search using map.