import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from './postgres';

// JWT secret key - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRES_IN = '7d';

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

// User interface
export interface User {
  id: string;
  email: string;
  full_name?: string;
  position_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Auth service
const authService = {
  /**
   * Register a new user
   * @param email - User email
   * @param password - User password
   * @param fullName - User full name
   * @returns Promise with the user data and token
   */
  async register(email: string, password: string, fullName: string): Promise<{ user: User; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      
      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Get default position (Agent)
      const positionResult = await db.query('SELECT id FROM positions WHERE name = $1', ['Agent']);
      const positionId = positionResult.rows.length > 0 ? positionResult.rows[0].id : null;
      
      // Insert the user
      const result = await db.query(
        'INSERT INTO users (email, password, full_name, position_id) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, position_id, created_at, updated_at',
        [email, hashedPassword, fullName, positionId]
      );
      
      const user = result.rows[0];
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          position_id: user.position_id
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      return { user, token };
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * Login a user
   * @param email - User email
   * @param password - User password
   * @returns Promise with the user data and token
   */
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    try {
      // Get the user
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      
      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }
      
      const user = result.rows[0];
      
      // Check the password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          position_id: user.position_id
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      // Remove password from user object
      delete user.password;
      
      return { user, token };
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * Verify a JWT token
   * @param token - JWT token
   * @returns User data from the token
   */
  verifyToken(token: string): User {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as User;
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  },
  
  /**
   * Get user by ID
   * @param id - User ID
   * @returns Promise with the user data
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const result = await db.query(
        'SELECT id, email, full_name, position_id, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * Update user profile
   * @param id - User ID
   * @param data - User data to update
   * @returns Promise with the updated user data
   */
  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    try {
      // Build the query dynamically based on the provided data
      const keys = Object.keys(data).filter(key => key !== 'id' && key !== 'email');
      const values = keys.map(key => data[key as keyof typeof data]);
      
      if (keys.length === 0) {
        return await this.getUserById(id);
      }
      
      const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      const query = `
        UPDATE users
        SET ${setClause}, updated_at = NOW()
        WHERE id = $${keys.length + 1}
        RETURNING id, email, full_name, position_id, created_at, updated_at
      `;
      
      const result = await db.query(query, [...values, id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * Change user password
   * @param id - User ID
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns Promise with success status
   */
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get the user
      const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      // Check the current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      
      // Update the password
      await db.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, id]
      );
      
      return true;
    } catch (error) {
      throw error;
    }
  }
};

export default authService;