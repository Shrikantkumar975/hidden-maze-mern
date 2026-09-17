import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
  playerId: { type: String, required: true, unique: true, index: true },
  completedLevels: { type: [Number], default: [] },
  bestMoves: { type: Map, of: Number, default: {} },
  bestTimeRemaining: { type: Map, of: Number, default: {} }
}, { timestamps: true });

export default mongoose.model('Progress', progressSchema);
