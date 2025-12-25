require('dotenv').config();
const path = require("path"); 
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const os = require("os");
const app = express();
app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// Fix: Use correct createPool method from mysql2
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
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
app.post("/comments", async (req, res) => {
    const { post_id, user_id, username, comment } = req.body;

    try {
        await db.execute("INSERT INTO comments (post_id, user_id, username, comment) VALUES (?, ?, ?, ?)",
            [post_id, user_id, username, comment]);

        const [postResults] = await db.execute("SELECT user_id, title FROM community_posts WHERE id = ?", [post_id]);

        if (postResults.length > 0) {
            const postOwnerId = postResults[0].user_id;
            const postTitle = postResults[0].title;

            if (postOwnerId !== user_id) {
                const notifText = `💬 ${username} replied on "${postTitle}": "${comment}"`;

                await db.execute(
                    "INSERT INTO notifications (receiver_id, sender_id, sender_name, message, category, read_status) VALUES (?, ?, ?, ?, 'comment', 0)",
                    [postOwnerId, user_id, username, notifText]
                );
            }
        }

        res.json({ message: "Comment added successfully!" });
    } catch (err) {
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
    res.sendFile(path.join(__dirname, "b4log.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://${localIp}:${PORT}`);
});