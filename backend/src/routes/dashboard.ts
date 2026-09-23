import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { stats } from './files';

const router = Router();
router.use(authenticate);
router.get('/stats', stats);
export default router;
