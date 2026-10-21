// ==========================================
// DATABASE KE MODELS (data ka shape)
// ==========================================

const mongoose = require("mongoose");

// ---------- TUTOR ----------

const tutorSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, unique: true, sparse: true }, // sparse: purane tutors ka email nahi hai, koi baat nahi
  phone:         String,
  college:       String,
  qualification: String,
  subjects:      { type: String, required: true },
  area:          { type: String, required: true },
  classes:       String,
  fees:          { type: Number, required: true },
  mode:          String,
  lat:           Number, // lagbhag location (1 km ke grid par round ki hui, exact nahi)
  lng:           Number,
  rating:        { type: Number, default: 0 },
  reviews:       { type: Number, default: 0 },
  verified:      { type: Boolean, default: false },
  owner:         { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, sparse: true }, // ek account = ek tutor profile
  createdAt:     { type: Date, default: Date.now }
});

// ---------- DEMO REQUEST ----------

const demoRequestSchema = new mongoose.Schema({
  tutor:        { type: mongoose.Schema.Types.ObjectId, ref: "Tutor", required: true },
  user:         { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // kis account ne request bheji
  studentName:  { type: String, required: true },
  phone:        { type: String, required: true },
  studentClass: { type: String, required: true },
  message:      String,
  lat:          Number, // student ki lagbhag location (1 km grid, exact nahi)
  lng:          Number,
  status:       { type: String, default: "new" },
  completedAt:  Date, // when the tutor marked the demo as completed
  createdAt:    { type: Date, default: Date.now }
});

// ---------- USER (account) ----------

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }, // asli password kabhi save nahi hota, sirf uska "hash"
  role:         { type: String, enum: ["student", "tutor"], default: "student" }, // student = padhna hai, tutor = padhana hai
  createdAt:    { type: Date, default: Date.now }
});

// ---------- SESSION (login yaad rakhne ke liye) ----------

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 } // 7 din baad apne aap delete
});

// ---------- REVIEW (a student rates a tutor after a completed demo) ----------

const reviewSchema = new mongoose.Schema({
  tutor:     { type: mongoose.Schema.Types.ObjectId, ref: "Tutor", required: true },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

// One review per student per tutor
reviewSchema.index({ tutor: 1, user: 1 }, { unique: true });

const Tutor = mongoose.model("Tutor", tutorSchema);
const DemoRequest = mongoose.model("DemoRequest", demoRequestSchema);
const User = mongoose.model("User", userSchema);
const Session = mongoose.model("Session", sessionSchema);
const Review = mongoose.model("Review", reviewSchema);

module.exports = { Tutor, DemoRequest, User, Session, Review };