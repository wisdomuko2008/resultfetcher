// index.js
require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const admin = require('firebase-admin');

// ===== FIREBASE SETUP (FIXED FOR RENDER) =====
let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // This runs on Render using the Environment Variable you added
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // This runs on your local computer using the physical file
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin initialized successfully.");
} catch (error) {
  console.error("Firebase initialization error:", error.message);
}

const db = admin.firestore();

// ===== EXPRESS & TWILIO =====
const app = express();
app.use(express.urlencoded({ extended: true })); // For Twilio webhook
app.use(express.json());

const MessagingResponse = twilio.twiml.MessagingResponse;

// ===== SUBJECT MAPPING =====
const subjectMap = {
  "ENG": "English",
  "GOV": "Government",
  "MATHS": "Mathematics",
  "PHY": "Physics",
  "CHE": "Chemistry",
  "BIO": "Biology",
  "ACC": "Accounting",
  "ECO": "Economics",
  "COM": "Commerce",
  "LIT": "Literature_in_English",
  "CRS": "C.R.K"
};

// ===== WHATSAPP WEBHOOK =====
app.post('/whatsapp', async (req, res) => {
  const twiml = new MessagingResponse();

  try {
    const fromNumber = req.body.From; // e.g. "whatsapp:+234803xxxxxxx"
    const sender = fromNumber.replace('whatsapp:', '');
    const body = req.body.Body ? req.body.Body.trim().toUpperCase() : '';

    if (body !== 'UTMERESULT') {
      twiml.message("❌ Invalid command. Send *UTMERESULT* to get your result.");
      return res.send(twiml.toString());
    }

    // ===== Fetch result from Firestore =====
    const resultsRef = db.collection('cbtResults');
    const querySnap = await resultsRef.where('whatsapp', '==', sender).get();

    if (querySnap.empty) {
      twiml.message(`❌ No UTME result found for WhatsApp number: ${sender}`);
      return res.send(twiml.toString());
    }

    const doc = querySnap.docs[0].data();
    const candidateName = doc.name || 'Candidate';

    // ===== Format result =====
    let resultText = '';
    let aggregate = 0;
    for (let shortSub in subjectMap) {
      if (doc[shortSub] !== undefined) {
        const score = doc[shortSub];
        resultText += `${shortSub}: ${score}, `;
        aggregate += Number(score);
      }
    }
    resultText += `Aggregate: ${aggregate}`;

    const reply = `Dear ${candidateName},\nWhatsApp Number: ${sender}\nYour UTME result: ${resultText}`;

    twiml.message(reply);
    res.send(twiml.toString());

  } catch (err) {
    console.error(err);
    twiml.message('❌ Error fetching result. Try again later.');
    res.send(twiml.toString());
  }
});

// ===== PORT =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WhatsApp bot running on port ${PORT}`));
          
