const express = require("express");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Tutor, DemoRequest, User, Session } = require("./models");

const app = express();
const PORT = 3000;

// MongoDB ka address. Local computer par MongoDB isi address par chalta hai.
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/walkintutor";

// Browser se aaya JSON data padhne ke liye (routes se PEHLE likhna zaroori hai)
app.use(express.json());

// ------------------------------------------
// LOGIN KA SYSTEM (helper functions)
// ------------------------------------------

const COOKIE_NAME = "walkin_session";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// Token ka hash banao (database mein asli token nahi, uska hash rakhte hain)
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Browser ki cookie se kisi cookie ki value nikalo
function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header.split(";");

  for (const part of parts) {
    const pieces = part.trim().split("=");
    if (pieces[0] === name) {
      return decodeURIComponent(pieces.slice(1).join("="));
    }
  }
  return null;
}

// Login hone par: ek random token banao, database mein save karo, cookie mein bhejo
async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");

  await Session.create({ tokenHash: hashToken(token), user: userId });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,   // JavaScript is cookie ko padh nahi sakta (chori se bachata hai)
    sameSite: "lax",
    maxAge: SEVEN_DAYS,
    secure: process.env.NODE_ENV === "production" // https par hi
  });
}

// Phone number ko "+91XXXXXXXXXX" shape mein badlo. Galat ho to null.
// India ke mobile number 6, 7, 8 ya 9 se shuru hote hain, aur 10 digit ke hote hain.
function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, ""); // sirf numbers rakho

  // Agar kisi ne 91 ke saath daala ho (jaise +91 98765 43210), to 91 hata do
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  if (!/^[6-9]\d{9}$/.test(digits)) {
    return null;
  }

  return "+91" + digits;
}

// Location ko 2 decimal tak round karo. Isse location lagbhag 1 km ke grid par aa jati hai,
// exact jagah kabhi save nahi hoti.
function approxCoordinate(value) {
  return Math.round(value * 100) / 100;
}

// Frontend ko sirf zaroori info do (password hash kabhi nahi)
function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

// Har /api request par: dekho kaun login hai
app.use("/api", async function (req, res, next) {
  req.user = null;

  try {
    const token = readCookie(req, COOKIE_NAME);

    if (token) {
      const session = await Session
        .findOne({ tokenHash: hashToken(token) })
        .populate("user", "name email role");

      if (session && session.user) {
        req.user = session.user;
      }
    }
  } catch (error) {
    console.log("Session check error:", error.message);
  }

  next();
});

// Jo routes sirf login wale logon ke liye hain, unpe ye lagayenge
function requireLogin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();
}

// Sirf ek khaas type (role) ke account ke liye: "student" ya "tutor"
function requireRole(role, message) {
  return function (req, res, next) {
    if (req.user.role !== role) {
      return res.status(403).json({ error: message });
    }
    next();
  };
}

// Galat password baar baar daalne se rokne ke liye (brute force se bachav)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW = 15 * 60 * 1000;

function tooManyAttempts(key) {
  const record = loginAttempts.get(key);
  return !!record && record.resetAt > Date.now() && record.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const record = loginAttempts.get(key);
  if (!record || record.resetAt < Date.now()) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + WINDOW });
  } else {
    record.count++;
  }
}

// ------------------------------------------
// API: signup, login, logout, me
// ------------------------------------------

app.post("/api/signup", async function (req, res) {
  try {
    const b = req.body || {};

    const name = String(b.name || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const password = typeof b.password === "string" ? b.password : "";
    const role = String(b.role || "").trim();

    if (role !== "student" && role !== "tutor") {
      return res.status(400).json({ error: "Please choose an account type: Student / Parent or Tutor." });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }

    if (email.length > 200 || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    // bcrypt sirf pehle 72 bytes padhta hai, isliye wahi limit
    if (password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: "Password must be between 8 and 72 characters long." });
    }

    const exists = await User.findOne({ email: email });
    if (exists) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Password ko hash karo (10 = kitna mushkil banana hai)
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({ name: name, email: email, passwordHash: passwordHash, role: role });

    await startSession(res, user._id);

    res.status(201).json({ user: publicUser(user) });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    console.log("Signup error:", error.message);
    res.status(500).json({ error: "Something went wrong on the server. Please try again." });
  }
});

app.post("/api/login", async function (req, res) {
  try {
    const b = req.body || {};

    const email = String(b.email || "").trim().toLowerCase();
    const password = typeof b.password === "string" ? b.password : "";

    if (!email || !password) {
      return res.status(400).json({ error: "Please enter both email and password." });
    }

    const key = email + "|" + req.ip;

    if (tooManyAttempts(key)) {
      return res.status(429).json({ error: "Too many failed attempts. Please try again after 15 minutes." });
    }

    const user = await User.findOne({ email: email });

    // Email galat ho ya password, message ek hi dete hain (hacker ko hint nahi milta)
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!ok) {
      recordFailure(key);
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    loginAttempts.delete(key);

    await startSession(res, user._id);

    res.json({ user: publicUser(user) });

  } catch (error) {
    console.log("Login error:", error.message);
    res.status(500).json({ error: "Something went wrong on the server. Please try again." });
  }
});

app.post("/api/logout", async function (req, res) {
  try {
    const token = readCookie(req, COOKIE_NAME);

    if (token) {
      await Session.deleteOne({ tokenHash: hashToken(token) });
    }
  } catch (error) {
    console.log("Logout error:", error.message);
  }

  res.clearCookie(COOKIE_NAME);
  res.json({ message: "Logged out successfully." });
});

// Frontend poochta hai: abhi kaun login hai?
app.get("/api/me", function (req, res) {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

// ------------------------------------------
// API: saare tutors dena
// ------------------------------------------

app.get("/api/tutors", async function (req, res) {
  try {
    // email, phone, college private hain, isliye "-" laga ke hata diye
    const tutors = await Tutor
      .find()
      .select("-email -phone -college -owner -__v")
      .sort({ _id: 1 })
      .lean();

    // MongoDB ka "_id" frontend ke liye "id" bana do
    const list = tutors.map(function (t) {
      const { _id, ...rest } = t;
      return { id: String(_id), ...rest };
    });

    res.json(list);
  } catch (error) {
    console.log("Error while loading tutors:", error.message);
    res.status(500).json({ error: "Something went wrong on the server. Please try again." });
  }
});

// ------------------------------------------
// API: naya tutor register karna
// ------------------------------------------

app.post("/api/tutors", requireLogin,
  requireRole("tutor", "Only Tutor accounts can create a tutor profile. Please sign up with a Tutor account."),
  async function (req, res) {
  try {
    const b = req.body || {};

    // String() lagane se koi chhupa hua object (hacking) text ban jata hai
    const name = String(b.name || "").trim();
    const email = req.user.email; // email hamesha account se aati hai
    const phoneRaw = String(b.phone || "").trim();
    const college = String(b.college || "").trim();
    const course = String(b.course || "").trim();
    const subjects = String(b.subjects || "").trim();
    const area = String(b.area || "").trim();
    const teachingClass = String(b.teachingClass || "").trim();
    const mode = String(b.mode || "").trim();
    const fees = Number(b.fees);

    // 1. Koi field khali to nahi?
    if (!name || !email || !phoneRaw || !college || !course ||
        !subjects || !area || !teachingClass || !mode) {
      return res.status(400).json({ error: "Please fill in all the details." });
    }

    // 2. Bahut lamba text to nahi?
    const allText = [name, email, phoneRaw, college, course, subjects, area, teachingClass, mode];
    if (allText.some(function (t) { return t.length > 200; })) {
      return res.status(400).json({ error: "One of the fields is too long." });
    }

    // 3. Email theek lag raha hai?
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    // 3b. Phone number 10 digit ka (India, +91)?
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return res.status(400).json({ error: "Phone number must be 10 digits and start with 6, 7, 8 or 9." });
    }

    // 3c. Location (map se aayi) sahi hai? India ke andar honi chahiye
    const rawLat = Number(b.lat);
    const rawLng = Number(b.lng);

    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) ||
        rawLat < 6 || rawLat > 38 || rawLng < 68 || rawLng > 98) {
      return res.status(400).json({ error: "Please choose your location on the map (within India)." });
    }

    // Exact location kabhi save nahi karte, sirf ~1 km ka round kiya hua point
    const lat = approxCoordinate(rawLat);
    const lng = approxCoordinate(rawLng);

    // 4. Fees sahi number hai?
    if (!Number.isInteger(fees) || fees <= 0 || fees > 100000) {
      return res.status(400).json({ error: "Fees must be a valid number." });
    }

    // 5. "Class 5 - 8" ko "5 6 7 8" mein badlo (search filter ke liye)
    const numbers = teachingClass.match(/\d+/g);
    if (!numbers || numbers.length < 2) {
      return res.status(400).json({ error: "The class range is not valid." });
    }

    const classList = [];
    for (let c = Number(numbers[0]); c <= Number(numbers[numbers.length - 1]); c++) {
      classList.push(c);
    }

    // 6. Is account ka tutor profile pehle se to nahi?
    const already = await Tutor.findOne({ $or: [{ owner: req.user._id }, { email: email }] });
    if (already) {
      return res.status(409).json({ error: "You already have a tutor profile." });
    }

    // Sab theek hai, database mein save karo
    const tutor = await Tutor.create({
      name: name,
      email: email,
      phone: phone,
      college: college,
      qualification: course,
      subjects: subjects,
      area: area,
      classes: classList.join(" "),
      fees: fees,
      mode: mode,
      lat: lat,
      lng: lng,
      verified: false,
      owner: req.user._id
    });

    res.status(201).json({ message: "Profile created!", id: String(tutor._id) });

  } catch (error) {
    // 11000 = MongoDB ka "duplicate" error (do log ek saath same email se)
    if (error.code === 11000) {
      return res.status(409).json({ error: "You already have a tutor profile." });
    }
    console.log("Error while saving tutor:", error.message);
    res.status(500).json({ error: "Something went wrong on the server. Please try again." });
  }
});

// ------------------------------------------
// API: demo request bhejna
// ------------------------------------------

app.post("/api/demo-requests", requireLogin,
  requireRole("student", "Only Student / Parent accounts can request a demo."),
  async function (req, res) {
  try {
    const b = req.body || {};

    const tutorId = String(b.tutorId || "").trim();
    const studentName = String(b.studentName || "").trim();
    const phoneRaw = String(b.phone || "").trim();
    const studentClass = String(b.studentClass || "").trim();
    const message = String(b.message || "").trim();

    // 1. Zaroori cheezein bhari hain?
    if (!tutorId || !studentName || !phoneRaw || !studentClass) {
      return res.status(400).json({ error: "Name, phone number and class are required." });
    }

    // 2. Tutor ki id sahi shape ki hai? (MongoDB id 24 letters/numbers ki hoti hai)
    if (!/^[a-f0-9]{24}$/i.test(tutorId)) {
      return res.status(400).json({ error: "Invalid tutor ID." });
    }

    // 3. Text bahut lamba to nahi?
    if (studentName.length > 100 || phoneRaw.length > 20 || message.length > 300) {
      return res.status(400).json({ error: "One of the fields is too long." });
    }

    // 4. Phone number 10 digit ka (India, +91)?
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return res.status(400).json({ error: "Phone number must be 10 digits and start with 6, 7, 8 or 9." });
    }

    // 4b. Student ki location (map se) sahi hai? India ke andar honi chahiye
    const rawLat = Number(b.lat);
    const rawLng = Number(b.lng);

    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) ||
        rawLat < 6 || rawLat > 38 || rawLng < 68 || rawLng > 98) {
      return res.status(400).json({ error: "Please choose your location on the map (within India)." });
    }

    // Exact location kabhi save nahi karte, sirf ~1 km ka round kiya hua point
    const lat = approxCoordinate(rawLat);
    const lng = approxCoordinate(rawLng);

    // 5. Class 5 se 12 ke beech?
    const cls = Number(studentClass);
    if (!Number.isInteger(cls) || cls < 5 || cls > 12) {
      return res.status(400).json({ error: "Class must be between 5 and 12." });
    }

    // 6. Ye tutor sach mein hai?
    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({ error: "Tutor not found." });
    }

    // 7. Is account ne isi tutor ko pehle request to nahi bheji?
    const already = await DemoRequest.findOne({ tutor: tutorId, user: req.user._id });
    if (already) {
      return res.status(409).json({ error: "You have already sent a request to this tutor." });
    }

    await DemoRequest.create({
      tutor: tutorId,
      user: req.user._id,
      studentName: studentName,
      phone: phone,
      studentClass: String(cls),
      message: message,
      lat: lat,
      lng: lng
    });

    res.status(201).json({ message: "Demo request sent!" });

  } catch (error) {
    console.log("Demo request error:", error.message);
    res.status(500).json({ error: "Something went wrong on the server. Please try again." });
  }
});

// ------------------------------------------
// API: tutor ko mili demo requests (sirf us tutor ko, jiska ye profile hai)
// ------------------------------------------

app.get("/api/my-requests", requireLogin,
  requireRole("tutor", "This page is only for Tutor accounts."),
  async function (req, res) {
  try {
    // Is account ka tutor profile dhundo
    const tutor = await Tutor.findOne({ owner: req.user._id }).lean();

    if (!tutor) {
      return res.json({ hasProfile: false, requests: [] });
    }

    // Sirf isi tutor ki requests, nayi pehle
    const found = await DemoRequest
      .find({ tutor: tutor._id })
      .sort({ _id: -1 })
      .lean();

    const requests = found.map(function (r) {
      return {
        id: String(r._id),
        studentName: r.studentName,
        phone: r.phone,
        studentClass: r.studentClass,
        message: r.message || "",
        lat: r.lat,
        lng: r.lng,
        createdAt: r.createdAt
      };
    });

    const tutorLocation = (typeof tutor.lat === "number" && typeof tutor.lng === "number")
      ? { lat: tutor.lat, lng: tutor.lng }
      : null;

    res.json({ hasProfile: true, tutorName: tutor.name, tutorLocation: tutorLocation, requests: requests });

  } catch (error) {
    console.log("My requests error:", error.message);
    res.status(500).json({ error: "Something went wrong on the server. Please try again." });
  }
});

// ------------------------------------------
// FRONTEND dikhana
// ------------------------------------------

app.use(express.static(path.join(__dirname, "..", "frontend")));

// ------------------------------------------
// SERVER START
// ------------------------------------------

async function start() {

  // 1. Pehle MongoDB se judo
  try {
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log("Could not connect to MongoDB:", error.message);
    console.log("Check that MongoDB is running (on Windows: Services > 'MongoDB Server') and that MONGO_URL in .env is correct.");
    return;
  }

  // Purane accounts ko role do (jo role banne se pehle bane the)
  const untagged = await User.find({ role: { $exists: false } });

  if (untagged.length > 0) {

    const owners = await Tutor.find({ owner: { $exists: true } }).select("owner").lean();
    const ownerIds = new Set(owners.map(function (t) { return String(t.owner); }));

    for (const account of untagged) {
      // Jiska tutor profile hai wo tutor, baaki student
      const role = ownerIds.has(String(account._id)) ? "tutor" : "student";
      await User.updateOne({ _id: account._id }, { $set: { role: role } });
    }

    console.log(untagged.length + " existing account(s) were assigned a role");
  }

  // 2. Agar tutors khali hain, to pehle wale 4 tutors daal do
  const total = await Tutor.countDocuments();

  if (total === 0) {
    await Tutor.insertMany([
      { name: "Manaswi Srivastava", qualification: "BCA 3rd Year", subjects: "Maths, Science", area: "Kunraghat", classes: "6 7 8 9 10", fees: 2000, rating: 4.9, reviews: 32, verified: true },
      { name: "Jiya Jaiswal", qualification: "BCA 3rd Year", subjects: "Maths, Physics", area: "Deoria", classes: "8 9 10 11 12", fees: 1800, rating: 4.7, reviews: 24, verified: true },
      { name: "Soumya Dwivedi", qualification: "BCA 3rd Year", subjects: "English, Hindi", area: "Sadar", classes: "5 6 7 8", fees: 1500, rating: 4.8, reviews: 41, verified: true },
      { name: "Neha Gupta", qualification: "B.A. 3rd Year", subjects: "English, Social Science", area: "Kannauj", classes: "5 6 7 8 9", fees: 1600, rating: 4.6, reviews: 18, verified: true }
    ]);
    console.log("Added 4 sample tutors to the database");
  }

  // Sample tutors ko unke area ke hisaab se lagbhag location do (sirf agar abhi nahi hai)
  const SEED_LOCATIONS = [
    { name: "Manaswi Srivastava", lat: 26.68, lng: 83.42 }, // Kunraghat
    { name: "Jiya Jaiswal", lat: 26.50, lng: 83.78 },       // Deoria
    { name: "Neha Gupta", lat: 27.05, lng: 79.91 }          // Kannauj
  ];

  for (const place of SEED_LOCATIONS) {
    await Tutor.updateOne(
      { name: place.name, lat: { $exists: false } },
      { $set: { lat: place.lat, lng: place.lng } }
    );
  }

  // 3. Ab server chalu karo
  app.listen(PORT, function (error) {
    if (error) {
      console.log("Could not start the server:", error.message);
      return;
    }
    console.log("Server running at http://localhost:" + PORT);
  });
}

start();