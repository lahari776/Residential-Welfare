require('dotenv').config();
const path = require("path"); 
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const os = require("os");
const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
//app.use(express.static(__dirname));
app.use(express.json());
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Email sending function
async function sendEmail(to, subject, htmlContent) {
  try {
    const mailOptions = {
      from: `"Resident Welfare App" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
// Fix: Use correct createPool method from mysql2
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "MySQL@123",
    database: "realp_db"
}).promise();

// ✅ User Signup
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    try {
        await db.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, password]);
        res.json({ message: "User registered successfully!" });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: err.message });
    }
});

// ✅ User Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const [results] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (results.length > 0) {
            const user = results[0];
            if (password === user.password) {
                return res.json({ message: "Login successful!", user });
            } else {
                return res.status(401).json({ error: "Invalid password" });
            }
        } else {
            return res.status(401).json({ error: "User not found" });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
app.post("/adminlogin", async (req, res) => {
  const { email, password } = req.body;

  try {
      const [results] = await db.execute("SELECT * FROM admins WHERE email = ?", [email]);
      if (results.length > 0) {
          const user = results[0];
          if (password === user.password) {
              return res.json({ message: "Login successful!", user });
          } else {
              return res.status(401).json({ error: "Invalid password" });
          }
      } else {
          return res.status(401).json({ error: "User not found" });
      }
  } catch (err) {
      return res.status(500).json({ error: err.message });
  }
});

// ✅ Fetch All Posts
app.get("/community", async (req, res) => {
    try {
        const [results] = await db.execute("SELECT * FROM community_posts ORDER BY created_at DESC");
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Create New Post + Send Notifications
app.post('/community', async (req, res) => {
    try {
        const { user_id, username, title, category, message } = req.body;
        const created_at = new Date();

        const [postResult] = await db.execute(
            'INSERT INTO community_posts (user_id, username, title, category, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, username, title, category, message, created_at]
        );

        const [users] = await db.execute('SELECT id FROM users WHERE id != ?', [user_id]);

        const notificationText = `📢 New post by ${username}: "${title}"\n\n${message}`;

        for (const user of users) {
            await db.execute(
                'INSERT INTO notifications (receiver_id, message, created_at, sender_id, sender_name, category, read_status) VALUES (?, ?, ?, ?, ?, ?, 0)',
                [user.id, notificationText, created_at, user_id, username, category]
            );
        }

        res.status(201).json({ id: postResult.insertId, message: 'Post created successfully' });

    } catch (error) {
        console.error('❌ Error creating post:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ✅ Edit Post
app.put("/community/:id", async (req, res) => {
    const { id } = req.params;
    const { user_id, message } = req.body;

    try {
        const [results] = await db.execute("SELECT * FROM community_posts WHERE id = ?", [id]);

        if (results.length > 0 && results[0].user_id === user_id) {
            await db.execute("UPDATE community_posts SET message = ? WHERE id = ?", [message, id]);
            res.json({ message: "Post updated successfully!" });
        } else {
            res.status(403).json({ error: "Unauthorized to edit this post" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Delete Post
app.delete("/community/:id", async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;

    try {
        const [results] = await db.execute("SELECT * FROM community_posts WHERE id = ?", [id]);

        if (results.length > 0 && results[0].user_id === user_id) {
            await db.execute("DELETE FROM community_posts WHERE id = ?", [id]);
            res.json({ message: "Post deleted successfully!" });
        } else {
            res.status(403).json({ error: "Unauthorized to delete this post" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Fetch Comments for a Post
app.get("/comments/:postId", async (req, res) => {
    const { postId } = req.params;
    try {
        const [results] = await db.execute("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC", [postId]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Add Comment + Notify Post Owner
// ✅ Add Comment + Notify Post Owner
app.post("/comments", async (req, res) => {
    const { post_id, user_id, username, comment } = req.body;
    const created_at = new Date();

    try {
        // Insert comment
        await db.execute(
            "INSERT INTO comments (post_id, user_id, username, comment, created_at) VALUES (?, ?, ?, ?, ?)",
            [post_id, user_id, username, comment, created_at]
        );

        // Get post details to notify the post owner
        const [postResult] = await db.execute("SELECT user_id FROM community_posts WHERE id = ?", [post_id]);
        const postOwnerId = postResult[0]?.user_id;

        // Avoid notifying the commenter themselves
        if (postOwnerId && postOwnerId !== user_id) {
            const notificationText = `💬 ${username} commented on your post:\n"${comment}"`;
            await db.execute(
                "INSERT INTO notifications (receiver_id, message, created_at, sender_id, sender_name, category, read_status) VALUES (?, ?, ?, ?, ?, ?, 0)",
                [postOwnerId, notificationText, created_at, user_id, username, 'comment']
            );
        }

        res.status(201).json({ message: "Comment added and notification sent!" });
    } catch (err) {
        console.error("❌ Error adding comment:", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ Fetch Notifications for a User
app.get("/notifications/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const [results] = await db.execute("SELECT * FROM notifications WHERE receiver_id = ? ORDER BY created_at DESC", [userId]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Mark Notification as Read
app.put("/notifications/:id/read", async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute("UPDATE notifications SET read_status = 1 WHERE id = ?", [id]);
        res.json({ message: "Notification marked as read!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Delete Notification
app.delete("/notifications/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute("DELETE FROM notifications WHERE id = ?", [id]);
        res.json({ message: "Notification deleted successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ✅ Send a Private Reply from Notification Page
app.post('/notifications/reply', async (req, res) => {
    const {
      receiver_id,
      sender_id,
      sender_name,
      message,
      category,
      read_status
    } = req.body;
  
    const created_at = new Date();
  
    // Debug log
    console.log("📦 Incoming Reply:", req.body);
  
    // Safety check: fallback to "direct_message"
    const safeCategory = category || "direct_message";
  
    try {
      await db.execute(
        `INSERT INTO notifications (receiver_id, sender_id, sender_name, message, category, read_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [receiver_id, sender_id, sender_name, message, safeCategory, read_status, created_at]
      );
  
      res.status(200).json({ message: 'Reply sent successfully' });
    } catch (err) {
      console.error("❌ Error in /notifications/reply:", err);
      res.status(500).json({ error: 'Failed to send reply' });
    }
  });

  app.get('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`Received profile request for user ID: ${userId}`);
    
    try {
      // Get basic user info from users table
      const [userResults] = await db.execute(
        `SELECT id, username, email FROM users WHERE id = ?`,
        [userId]
      );
      
      console.log(`User results for ID ${userId}:`, userResults);
      
      if (userResults.length === 0) {
        console.log(`No user found with ID ${userId}`);
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get profile info
      const [profileResults] = await db.execute(
        `SELECT full_name, phone, address, unit_number, residency_type, move_in_date, 
                emergency_contact_name, emergency_contact_phone, bio 
         FROM user_profiles WHERE user_id = ?`,
        [userId]
      );
      
      console.log(`Profile results for user ID ${userId}:`, profileResults);
      
      // Combine user and profile data
      const user = {
        ...userResults[0],
        ...(profileResults[0] || {})
      };
      
      // Get user posts and comments
      const [posts] = await db.execute(
        "SELECT * FROM community_posts WHERE user_id = ? ORDER BY created_at DESC", 
        [userId]
      );
      
      const [comments] = await db.execute(
        //"SELECT * FROM comments WHERE user_id = ? ORDER BY created_at DESC", 
        `SELECT c.*, cp.title AS post_title
   FROM comments c
   JOIN community_posts cp ON c.post_id = cp.id
   WHERE c.user_id = ?
   ORDER BY c.created_at DESC`,

      [userId]
    

        //[userId]
      );
  
      console.log(`Sending profile data for user ${userId}:`, { 
        user: user,
        postsCount: posts.length,
        commentsCount: comments.length 
      });
      
      res.json({ user, posts, comments });
      
    } catch (err) {
      console.error(`Error fetching profile for user ${userId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });
                // Add this to your server.js file

// Profile update route
app.put('/profile/update/:userId', async (req, res) => {
    const userId = req.params.userId;
    const {
      full_name,
      email,  // Include email if you need to update it
      phone,
      address,
      unit_number,
      residency_type,
      move_in_date,
      emergency_contact_name,
      emergency_contact_phone,
      bio,
      role
    } = req.body;
    try {
      const move_in = move_in_date === '' ? null : move_in_date;
    
      // Check if profile exists first
      const [profileCheck] = await db.execute(
        "SELECT * FROM user_profiles WHERE user_id = ?", 
        [userId]
      );
      
      if (profileCheck.length === 0) {
        // If no profile exists, insert a new one
        await db.execute(
          `INSERT INTO user_profiles (
            user_id, full_name, phone, address, unit_number, 
            residency_type, move_in_date, emergency_contact_name, 
            emergency_contact_phone, bio
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, full_name, phone, address, unit_number,
            residency_type, move_in, emergency_contact_name,
            emergency_contact_phone, bio
          ]
        );
      } else {
        // If profile exists, update it
        await db.execute(
          `UPDATE user_profiles
           SET full_name = ?, phone = ?, address = ?, unit_number = ?,
               residency_type = ?, move_in_date = ?, emergency_contact_name = ?,
               emergency_contact_phone = ?, bio = ?
           WHERE user_id = ?`,
          [
            full_name, phone, address, unit_number,
            residency_type, move_in, emergency_contact_name,
            emergency_contact_phone, bio, userId
          ]
        );
      }
    
      // Optionally update email in users table if needed
      if (email) {
        await db.execute(
          "UPDATE users SET email = ? WHERE id = ?",
          [email, userId]
        );
      }
  
      res.json({
        success: true,
        message: 'Profile updated successfully'
      });
  
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while updating profile',
        error: error.message
      });
    }
});    
// Add these routes to your server.js file
// ✅ Admin: Get all users
app.get("/admin/users", async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, username, email FROM users");
    const [admins] = await db.query("SELECT email FROM admins");
    const adminEmails = admins.map(admin => admin.email);

    const enhancedUsers = users.map(user => ({
      ...user,
      isAdmin: adminEmails.includes(user.email),
    }));

    res.json(enhancedUsers);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Add new user
app.post("/admin/users", async (req, res) => {
  const { username, email, password, isAdmin } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required" });
  }

  try {
    await db.query("START TRANSACTION");

    await db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, password]
    );

    if (isAdmin) {
      await db.query(
        "INSERT INTO admins (email, password) VALUES (?, ?)",
        [email, password]
      );
    }

    await db.query("COMMIT");
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    await db.query("ROLLBACK");

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Update user
app.put("/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  const { username, email, password, isAdmin } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: "Username and email are required" });
  }

  try {
    await db.query("START TRANSACTION");

    const [currentUserData] = await db.query("SELECT email FROM users WHERE id = ?", [id]);

    if (currentUserData.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const currentEmail = currentUserData[0].email;

    if (email !== currentEmail) {
      const [existingEmail] = await db.query(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email, id]
      );

      if (existingEmail.length > 0) {
        await db.query("ROLLBACK");
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    if (password) {
      await db.query(
        "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?",
        [username, email, password, id]
      );
    } else {
      await db.query(
        "UPDATE users SET username = ?, email = ? WHERE id = ?",
        [username, email, id]
      );
    }

    const [isCurrentlyAdmin] = await db.query("SELECT email FROM admins WHERE email = ?", [currentEmail]);

    if (isAdmin && isCurrentlyAdmin.length === 0) {
      await db.query(
        "INSERT INTO admins (email, password) VALUES (?, ?)",
        [email, password || (await db.query("SELECT password FROM users WHERE id = ?", [id]))[0][0].password]
      );
    } else if (!isAdmin && isCurrentlyAdmin.length > 0) {
      await db.query("DELETE FROM admins WHERE email = ?", [currentEmail]);
    } else if (isAdmin && isCurrentlyAdmin.length > 0 && (email !== currentEmail || password)) {
      const updateQuery = password
        ? "UPDATE admins SET email = ?, password = ? WHERE email = ?"
        : "UPDATE admins SET email = ? WHERE email = ?";
      const params = password ? [email, password, currentEmail] : [email, currentEmail];
      await db.query(updateQuery, params);
    }

    await db.query("COMMIT");
    res.json({ message: "User updated successfully" });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error updating user:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Delete user
app.delete("/admin/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("START TRANSACTION");

    const [userData] = await db.query("SELECT email FROM users WHERE id = ?", [id]);

    if (userData.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const userEmail = userData[0].email;

    await db.query("DELETE FROM notifications WHERE sender_id = ? OR receiver_id = ?", [id, id]);
    await db.query("DELETE FROM comments WHERE user_id = ?", [id]);
    await db.query("DELETE FROM community_posts WHERE user_id = ?", [id]);
    await db.query("DELETE FROM user_profiles WHERE user_id = ?", [id]);
    await db.query("DELETE FROM admins WHERE email = ?", [userEmail]);
    await db.query("DELETE FROM users WHERE id = ?", [id]);

    await db.query("COMMIT");
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error deleting user:", err);
    res.status(500).json({ error: err.message });
  }
});
// Add these routes to your server.js file

// ✅ Admin: Get all payments
app.get("/admin/payments", async (req, res) => {
  try {
    const [payments] = await db.query(`
      SELECT p.*, u.username, u.email 
      FROM payments p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.due_date ASC
    `);
    
    res.json(payments);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Create new payment
// ✅ Admin: Create new payment
app.post("/admin/payments", async (req, res) => {
  const { user_id, amount, category, status, due_date } = req.body;

  if (!user_id || !amount || !category || !status || !due_date) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO payments (user_id, amount, category, status, due_date) VALUES (?, ?, ?, ?, ?)",
      [user_id, amount, category, status, due_date]
    );
    
    // Notify the user about the new payment
    const [userResult] = await db.execute("SELECT username FROM users WHERE id = ?", [user_id]);
    const username = userResult[0]?.username;
    
    const notificationText = `💰 ${category} payment of $${amount} is due on ${due_date}`;
    await db.execute(
      "INSERT INTO notifications (sender_id, sender_name, receiver_id, message, category, read_status) VALUES (?, ?, ?, ?, ?, 0)",
      [1, 'Admin', user_id, notificationText, 'payment']
    );
    
    res.status(201).json({ 
      message: "Payment created successfully", 
      payment_id: result.insertId 
    });
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Update payment status
app.put("/admin/payments/:id", async (req, res) => {
  const { id } = req.params;
  const { status, amount, category, due_date } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    // Get the current payment data to check if there's a change
    const [currentPayment] = await db.execute("SELECT * FROM payments WHERE id = ?", [id]);
    
    if (currentPayment.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    const updateData = [];
    const updateValues = [];
    
    if (status) {
      updateData.push("status = ?");
      updateValues.push(status);
    }
    
    if (amount) {
      updateData.push("amount = ?");
      updateValues.push(amount);
    }
    
    if (category) {
      updateData.push("category = ?");
      updateValues.push(category);
    }
    
    if (due_date) {
      updateData.push("due_date = ?");
      updateValues.push(due_date);
    }
    
    if (updateData.length === 0) {
      return res.status(400).json({ error: "No data to update" });
    }
    
    updateValues.push(id);
    
    await db.execute(
      `UPDATE payments SET ${updateData.join(", ")} WHERE id = ?`,
      updateValues
    );
    
    // Notify user if status changed to completed
    if (status === 'Completed' && currentPayment[0].status !== 'Completed') {
      const user_id = currentPayment[0].user_id;
      const paymentCategory = category || currentPayment[0].category || 'payment';
      const notificationText = `✅ Your ${paymentCategory} payment of $${amount || currentPayment[0].amount} has been marked as completed`;
      
      await db.execute(
        "INSERT INTO notifications (receiver_id, message, category, read_status) VALUES (?, ?, ?, 0)",
        [user_id, notificationText, 'payment']
      );
    }
    
    res.json({ message: "Payment updated successfully" });
  } catch (err) {
    console.error("Error updating payment:", err);
    res.status(500).json({ error: err.message });
  }
});
// ✅ Admin: Update payment status
app.put("/admin/payments/:id", async (req, res) => {
  const { id } = req.params;
  const { status, amount, due_date } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    // Get the current payment data to check if there's a change
    const [currentPayment] = await db.execute("SELECT * FROM payments WHERE id = ?", [id]);
    
    if (currentPayment.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    const updateData = [];
    const updateValues = [];
    
    if (status) {
      updateData.push("status = ?");
      updateValues.push(status);
    }
    
    if (amount) {
      updateData.push("amount = ?");
      updateValues.push(amount);
    }
    
    if (due_date) {
      updateData.push("due_date = ?");
      updateValues.push(due_date);
    }
    
    if (updateData.length === 0) {
      return res.status(400).json({ error: "No data to update" });
    }
    
    updateValues.push(id);
    
    await db.execute(
      `UPDATE payments SET ${updateData.join(", ")} WHERE id = ?`,
      updateValues
    );
    
    // Notify user if status changed to completed
    if (status === 'Completed' && currentPayment[0].status !== 'Completed') {
      const user_id = currentPayment[0].user_id;
      const notificationText = `✅ Your payment of $${currentPayment[0].amount} has been marked as completed`;
      
      await db.execute(
        "INSERT INTO notifications (receiver_id, message, created_at, category, read_status) VALUES (?, ?, ?, ?, 0)",
        [user_id, notificationText, new Date(), 'payment']
      );
    }
    
    res.json({ message: "Payment updated successfully" });
  } catch (err) {
    console.error("Error updating payment:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Delete payment
app.delete("/admin/payments/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.execute("DELETE FROM payments WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    res.json({ message: "Payment deleted successfully" });
  } catch (err) {
    console.error("Error deleting payment:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ User: Get payments for a specific user
app.get("/user/payments/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const [payments] = await db.execute(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY due_date ASC",
      [userId]
    );
    
    res.json(payments);
  } catch (err) {
    console.error("Error fetching user payments:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get payments summary (for dashboard)
app.get("/admin/payments/summary", async (req, res) => {
  try {
    // Get total payments by status
    const [statusSummary] = await db.query(`
      SELECT status, COUNT(*) as count, SUM(amount) as total
      FROM payments
      GROUP BY status
    `);
    
    // Get upcoming payments (due in the next 7 days)
    const [upcomingPayments] = await db.query(`
      SELECT p.*, u.username, u.email
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'Pending' 
      AND p.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY p.due_date ASC
    `);
    
    // Get overdue payments
    const [overduePayments] = await db.query(`
      SELECT p.*, u.username, u.email
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'Pending' 
      AND p.due_date < CURDATE()
      ORDER BY p.due_date ASC
    `);
    
    res.json({
      summary: statusSummary,
      upcoming: upcomingPayments,
      overdue: overduePayments
    });
  } catch (err) {
    console.error("Error fetching payments summary:", err);
    res.status(500).json({ error: err.message });
  }
});
// Add this endpoint to server.js (before the app.listen line)

// ✅ Get dashboard statistics
app.get("/admin/dashboard-stats", async (req, res) => {
  try {
    // Get total number of users/residents
    const [usersResult] = await db.execute("SELECT COUNT(*) as count FROM users");
    const totalResidents = usersResult[0].count;
    
    // Get number of pending payments
    const [paymentsResult] = await db.execute("SELECT COUNT(*) as count FROM payments WHERE status = 'Pending'");
    const pendingPayments = paymentsResult[0].count;
    
    // Get number of community posts
    const [postsResult] = await db.execute("SELECT count(*) as count FROM notifications where receiver_id=1");
    const totalPosts = postsResult[0].count;
    
    res.json({
      totalResidents,
      pendingPayments,
      totalPosts
    });
  } catch (err) {
    console.error("Error fetching dashboard statistics:", err);
    res.status(500).json({ error: err.message });
  }
});
// ✅ User: Process a payment
// ✅ User: Process a payment
app.post("/user/payments/process", async (req, res) => {
  const { payment_id, user_id, amount } = req.body;
  
  console.log("Payment processing attempt:", { payment_id, user_id, amount });
  
  try {
    // First, check if the payment and user exist
    const [paymentCheck] = await db.execute(
      "SELECT * FROM payments WHERE id = ? AND user_id = ?",
      [payment_id, user_id]
    );
    
    if (paymentCheck.length === 0) {
      console.log("Payment not found:", { payment_id, user_id });
      return res.status(404).json({ 
        success: false,
        error: "Payment not found" 
      });
    }
    
    // Now update the payment
    const payment_date = new Date().toISOString().split('T')[0];
    
    const [updateResult] = await db.execute(
      "UPDATE payments SET status = 'Completed', payment_date = ? WHERE id = ? AND user_id = ?",
      [payment_date, payment_id, user_id]
    );
    
    console.log("Update result:", updateResult);
    
    // Check if the update was successful
    if (updateResult.affectedRows === 0) {
      console.log("Update failed - no rows affected");
      return res.status(500).json({ 
        success: false,
        error: "Failed to update payment" 
      });
    }
    
    // Add a notification about successful payment
   
    
    res.json({ 
      success: true, 
      message: "Payment processed successfully",
      payment_date: payment_date
    });
  } catch (err) {
    console.error("Error processing payment:", err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});
// ✅ User: Get payment history
app.get("/user/payments/history/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const [payments] = await db.execute(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY due_date DESC",
      [userId]
    );
    
    res.json(payments);
  } catch (err) {
    console.error("Error fetching payment history:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ User: Get payment statistics
app.get("/user/payments/stats/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Get payment statistics
    const [result] = await db.execute(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_payments,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_payments,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed_payments,
        SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END) as total_pending_amount,
        SUM(CASE WHEN status = 'Completed' THEN amount ELSE 0 END) as total_paid_amount
      FROM payments
      WHERE user_id = ?
    `, [userId]);
    
    // Get upcoming payments
    const [upcomingPayments] = await db.execute(`
      SELECT * FROM payments
      WHERE user_id = ? AND status = 'Pending' AND due_date >= CURDATE()
      ORDER BY due_date ASC
      LIMIT 5
    `, [userId]);
    
    // Get overdue payments
    const [overduePayments] = await db.execute(`
      SELECT * FROM payments
      WHERE user_id = ? AND status = 'Pending' AND due_date < CURDATE()
      ORDER BY due_date ASC
    `, [userId]);
    
    res.json({
      stats: result[0],
      upcoming: upcomingPayments,
      overdue: overduePayments
    });
  } catch (err) {
    console.error("Error fetching payment stats:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/user/payments/category/:userId/:category", async (req, res) => {
  const { userId, category } = req.params;
  
  try {
    let query;
    let params;
    
    if (category.toLowerCase() === 'all') {
      query = "SELECT * FROM payments WHERE user_id = ? ORDER BY due_date ASC";
      params = [userId];
    } else {
      query = "SELECT * FROM payments WHERE user_id = ? AND category = ? ORDER BY due_date ASC";
      params = [userId, category];
    }
    
    const [payments] = await db.execute(query, params);
    
    res.json(payments);
  } catch (err) {
    console.error("Error fetching payments by category:", err);
    res.status(500).json({ error: err.message });
  }
});
// ✅ Fetch All Complaints for a User
app.get("/complaints/user/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const [complaints] = await db.execute(
      "SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    res.json(complaints);
  } catch (err) {
    console.error("Error fetching complaints:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Create New Complaint
app.post("/complaints", async (req, res) => {
  const { user_id, title, category, description } = req.body;
  
  if (!user_id || !title || !category || !description) {
    return res.status(400).json({ error: "All fields are required" });
  }
  
  try {
    // Insert the complaint
    const [result] = await db.execute(
      "INSERT INTO complaints (user_id, title, category, description, status) VALUES (?, ?, ?, ?, 'Pending')",
      [user_id, title, category, description]
    );
    
    // Get admin user IDs to notify them
    const [admins] = await db.execute("SELECT id FROM users WHERE email IN (SELECT email FROM admins)");
    
    // Get the username of the person filing the complaint
    const [userResult] = await db.execute("SELECT username FROM users WHERE id = ?", [user_id]);
    const username = userResult[0]?.username || "A resident";
    
    // Create notifications for admins
    const notificationText = `🔔 New complaint filed by ${username}: "${title}" - ${category}`;
    
    for (const admin of admins) {
      await db.execute(
        "INSERT INTO notifications (receiver_id, message, category, read_status, created_at, sender_id, sender_name) VALUES (?, ?, ?, 0, ?, ?, ?)",
        [admin.id, notificationText, "complaints", new Date(), user_id, username]
      );
    }
    
    res.status(201).json({ 
      message: "Complaint submitted successfully",
      complaint_id: result.insertId
    });
  } catch (err) {
    console.error("Error creating complaint:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update Complaint (for users to add more details)
app.put("/complaints/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id, description } = req.body;
  
  try {
    // Verify the complaint belongs to the user
    const [complaintCheck] = await db.execute(
      "SELECT * FROM complaints WHERE id = ? AND user_id = ?",
      [id, user_id]
    );
    
    if (complaintCheck.length === 0) {
      return res.status(403).json({ error: "Unauthorized to update this complaint" });
    }
    
    // Only allow updates if complaint is still pending
    if (complaintCheck[0].status !== 'Pending') {
      return res.status(400).json({ error: "Cannot update complaint that is already in progress or resolved" });
    }
    
    await db.execute(
      "UPDATE complaints SET description = ? WHERE id = ?",
      [description, id]
    );
    
    res.json({ message: "Complaint updated successfully" });
  } catch (err) {
    console.error("Error updating complaint:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Get all complaints
app.get("/admin/complaints", async (req, res) => {
  try {
    const [complaints] = await db.execute(`
      SELECT c.*, u.username, u.email
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      ORDER BY 
        CASE 
          WHEN c.status = 'Pending' THEN 1
          WHEN c.status = 'In Progress' THEN 2
          WHEN c.status = 'Resolved' THEN 3
        END,
        c.created_at DESC
    `);
    
    res.json(complaints);
  } catch (err) {
    console.error("Error fetching complaints:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Update complaint status
app.put("/admin/complaints/:id", async (req, res) => {
  const { id } = req.params;
  const { status, admin_response } = req.body;
  
  try {
    // Get the complaint details first
    const [complaintCheck] = await db.execute(
      "SELECT user_id, title, category FROM complaints WHERE id = ?", 
      [id]
    );
    
    if (complaintCheck.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    
    // Update the complaint
    await db.execute(
      "UPDATE complaints SET status = ?, admin_response = ?, updated_at = NOW() WHERE id = ?",
      [status, admin_response, id]
    );
    
    // Notify the user about the status change
    const complaint = complaintCheck[0];
    const statusText = status === 'Resolved' ? 'resolved' : (status === 'In Progress' ? 'being addressed' : status);
    const notificationText = `📝 Your complaint "${complaint.title}" is now ${statusText}.${admin_response ? `\n\nResponse: ${admin_response}` : ''}`;
    
    await db.execute(
      "INSERT INTO notifications (sender_id, sender_name, receiver_id, message, category, read_status, created_at) VALUES (?,?,?, ?, ?, 0, ?)",
      [1, 'Admin', complaint.user_id, notificationText, "complaints", new Date()]
    );
    
    
    res.json({ message: "Complaint status updated successfully" });
  } catch (err) {
    console.error("Error updating complaint:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get complaint statistics for dashboard
app.get("/admin/complaints/stats", async (req, res) => {
  try {
    // Get counts by status
    const [statusStats] = await db.execute(`
      SELECT status, COUNT(*) as count
      FROM complaints
      GROUP BY status
    `);
    
    // Get counts by category
    const [categoryStats] = await db.execute(`
      SELECT category, COUNT(*) as count
      FROM complaints
      GROUP BY category
      ORDER BY count DESC
    `);
    
    // Get recent unresolved complaints
    const [recentComplaints] = await db.execute(`
      SELECT c.*, u.username
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE c.status != 'Resolved'
      ORDER BY c.created_at DESC
      LIMIT 5
    `);
    
    res.json({
      byStatus: statusStats,
      byCategory: categoryStats,
      recent: recentComplaints
    });
  } catch (err) {
    console.error("Error fetching complaint stats:", err);
    res.status(500).json({ error: err.message });
  }
});
async function updatePaymentStatus() {
  const payment_id = getUrlParam('payment_id');
  const user_id = getUrlParam('user_id');
  const amount = getUrlParam('amount');
  
  if (!payment_id || !user_id || !amount) {
      console.error("Missing required parameters for payment update:", { payment_id, user_id, amount });
      document.getElementById("statusMessage").innerText = "Error: Missing payment information";
      document.getElementById("statusMessage").className = "status-message error-message";
      document.getElementById("statusMessage").style.display = "block";
      return;
  }
  
  try {
      console.log("Sending payment update request:", {
          payment_id: parseInt(payment_id),
          user_id: parseInt(user_id),
          amount: parseFloat(amount)
      });
      
      const response = await fetch('/user/payments/process', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              payment_id: parseInt(payment_id),
              user_id: parseInt(user_id),
              amount: parseFloat(amount)
          })
      });
      
      const result = await response.json();
      console.log("Payment update response:", result);
      
      if (result.success) {
          document.getElementById("statusMessage").innerText = "Payment updated successfully in records!";
          document.getElementById("statusMessage").className = "status-message success-message";
          document.getElementById("statusMessage").style.display = "block";
      } else {
          console.error("Error updating payment:", result.error);
          document.getElementById("statusMessage").innerText = "Note: Payment received but not updated in records. Please contact support.";
          document.getElementById("statusMessage").className = "status-message error-message";
          document.getElementById("statusMessage").style.display = "block";
      }
  } catch (error) {
      console.error("Failed to update payment status:", error);
      document.getElementById("statusMessage").innerText = "Note: Payment received but not updated in records. Please contact support.";
      document.getElementById("statusMessage").className = "status-message error-message";
      document.getElementById("statusMessage").style.display = "block";
  }
}
// In your server-side code:
  // ✅ Start Server
const PORT = 5000;

// Local IP
const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
};
const localIp = getLocalIp();

// ✅ Serve b4login.html on root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "html/b4log.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://${localIp}:${PORT}`);
});