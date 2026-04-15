const mongoose = require("mongoose");

const summarySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  points: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("Summary", summarySchema);