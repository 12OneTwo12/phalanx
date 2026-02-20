import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../../models/user.model.js';

const router: Router = Router();

// Password validation schema
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Registration request schema
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
});

// Registration endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = registerSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: validationResult.error.errors[0].message,
        details: validationResult.error.errors,
      });
    }

    const { email, password, username } = validationResult.data;

    // Check if user with email already exists
    const existingUserByEmail = await User.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingUserByEmail) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email already registered',
      });
    }

    // Check if user with username already exists
    const existingUserByUsername = await User.findOne({ 
      username: username 
    });
    
    if (existingUserByUsername) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already taken',
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      email: email.toLowerCase(),
      password_hash,
      username,
      email_verified: false,
    });

    // Save user to database
    await newUser.save();

    // Return success response (exclude sensitive data)
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        email_verified: newUser.email_verified,
        created_at: newUser.created_at,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle mongoose duplicate key error
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email or username already exists',
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during registration',
    });
  }
});

export default router;