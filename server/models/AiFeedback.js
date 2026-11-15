const mongoose = require('mongoose');

const AiFeedbackSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'recommendation' },
    context: { type: String, default: '' },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    helpful: { type: Boolean, default: true },
    comment: { type: String, default: '' },
    sessionId: { type: String, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AiFeedback', AiFeedbackSchema);

