// Demo requests dekhne ke liye: node show-requests.js
const mongoose = require("mongoose");
const { DemoRequest } = require("./models");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/walkintutor";

async function main() {
  try {
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });

    // populate: tutor ki id ki jagah uski poori detail le aao
    const requests = await DemoRequest.find().populate("tutor", "name").populate("user", "email").sort({ _id: -1 });

    if (requests.length === 0) {
      console.log("No demo requests yet.");
    }

    requests.forEach(function (r, i) {
      console.log("--------------------------------");
      console.log("Request #" + (requests.length - i) + "  (" + r.createdAt.toLocaleString() + ")");
      console.log("Tutor   : " + (r.tutor ? r.tutor.name : "(tutor was removed)"));
      console.log("Student : " + r.studentName + " (Class " + r.studentClass + ")");
      console.log("Phone   : " + r.phone);
      if (r.user) console.log("Account : " + r.user.email);
      if (r.message) console.log("Message : " + r.message);
      if (typeof r.lat === "number") console.log("Location: approx " + r.lat + ", " + r.lng + " (1 km area)");
    });
  } catch (error) {
    console.log("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();