const express = require("express");
const Summary = require("../models/Summary");

const router = express.Router();

// Save summary
router.post("/save", async (req, res) => {
  try {
    console.log("SAVE BODY:", req.body);

    const { userId, text, summary, points } = req.body;

    if (!userId || !text || !summary) {
      return res.status(400).json({
        message: "userId, text and summary are required"
      });
    }

    const newSummary = await Summary.create({
      userId,
      text,
      summary,
      points: points || []
    });

    return res.status(201).json({
      message: "Saved successfully",
      data: newSummary
    });
  } catch (err) {
    console.log("SAVE ERROR:", err);
    return res.status(500).json({
      message: "Save failed"
    });
  }
});

// Get all summaries for one user
router.get("/:userId", async (req, res) => {
  try {
    const summaries = await Summary.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });

    return res.json(summaries);
  } catch (err) {
    console.log("FETCH ERROR:", err);
    return res.status(500).json({
      message: "Error fetching history"
    });
  }
});

// Delete one summary
router.delete("/:id", async (req, res) => {
  try {
    await Summary.findByIdAndDelete(req.params.id);
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.log("DELETE ERROR:", err);
    return res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;