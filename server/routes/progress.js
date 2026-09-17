import { Router } from 'express';
import mongoose from 'mongoose';
import Progress from '../models/Progress.js';

const router = Router();

const requireDatabase = (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Progress database unavailable' });
  }
  next();
};

const normalize = (doc) => ({
  playerId: doc.playerId,
  completedLevels: doc.completedLevels ?? [],
  bestMoves: Object.fromEntries(doc.bestMoves ?? new Map()),
  bestTimeRemaining: Object.fromEntries(doc.bestTimeRemaining ?? new Map())
});

router.get('/:playerId', requireDatabase, async (req, res) => {
  try {
    let progress = await Progress.findOne({ playerId: req.params.playerId });
    if (!progress) progress = await Progress.create({ playerId: req.params.playerId });
    res.json(normalize(progress));
  } catch (error) {
    res.status(500).json({ message: 'Could not load progress' });
  }
});

router.post('/:playerId/complete', requireDatabase, async (req, res) => {
  try {
    const levelIndex = Number(req.body.levelIndex);
    const moves = Number(req.body.moves);
    const timeRemaining = Number(req.body.timeRemaining);

    if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex > 19) {
      return res.status(400).json({ message: 'Invalid level index' });
    }

    let progress = await Progress.findOne({ playerId: req.params.playerId });
    if (!progress) progress = await Progress.create({ playerId: req.params.playerId });

    if (!progress.completedLevels.includes(levelIndex)) {
      progress.completedLevels.push(levelIndex);
      progress.completedLevels.sort((a, b) => a - b);
    }

    const oldMoves = progress.bestMoves.get(String(levelIndex));
    const oldTime = progress.bestTimeRemaining.get(String(levelIndex));

    if (Number.isFinite(moves) && (!oldMoves || moves < oldMoves)) {
      progress.bestMoves.set(String(levelIndex), moves);
    }
    if (Number.isFinite(timeRemaining) && (!oldTime || timeRemaining > oldTime)) {
      progress.bestTimeRemaining.set(String(levelIndex), timeRemaining);
    }

    await progress.save();
    res.json(normalize(progress));
  } catch (error) {
    res.status(500).json({ message: 'Could not save progress' });
  }
});

router.delete('/:playerId', requireDatabase, async (req, res) => {
  try {
    let progress = await Progress.findOne({ playerId: req.params.playerId });
    if (!progress) {
      progress = await Progress.create({ playerId: req.params.playerId });
    } else {
      progress.completedLevels = [];
      progress.bestMoves.clear();
      progress.bestTimeRemaining.clear();
      await progress.save();
    }
    res.json(normalize(progress));
  } catch (error) {
    res.status(500).json({ message: 'Could not reset progress' });
  }
});

export default router;
