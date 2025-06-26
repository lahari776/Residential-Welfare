# KiTS MM2 Resident Welfare Association Management Web App

## Overview

The **KiTS RWAM Web App** is a full-stack web application designed to improve the quality of life within residential communities. This platform allows residents and administrators to manage various community services, including registration, payments, communication through a community forum, and more. The app features notifications, complaint tracking, and email communication, providing an efficient and organized way to manage a community.

This project is ideal for residential societies, gated communities, or any housing complex that needs a robust system for everyday community management.

## Key Features

- **Community Forum:** Residents can create posts, comment, and reply to other posts, encouraging community discussions.

- **Real-Time Notifications:** Residents and admins receive notifications for new posts, replies, and important updates within the community.

- **Complaints System:** Residents can submit complaints, track their status, and get updates on resolutions.

- **Admin Payment Management:** Admins can manage payments by adding, editing, and deleting payment records, as well as tracking payment statuses.

- **Admin User Management:** Admins can manage user accounts and control access levels for residents and staff.

- **Email Notifications (Nodemailer):** The app sends email notifications for key actions, such as post replies, payment updates, and important community announcements, using **Nodemailer** for email delivery.

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js with Express.js
- **Database:** MySQL
- **Real-Time Notifications:** Socket.io (optional for real-time updates)
- **Email Sending:** Nodemailer for email communication
- **WhatsApp Integration:** CSV data export import scripts. Or API integration whatever is feseble.
- **MyGate Integration:** CSV data export import scripts. Or API integration whatever is feseble.

## Installation

### Prerequisites

To run this application locally, you'll need the following installed:

- **Node.js**: To run the backend.
- **MySQL**: For the database.
- **phpMyAdmin**: For database management.
- **Postman** (optional): For testing APIs.
- **Email Account:** Set up an email account for Nodemailer to send emails (e.g., Gmail, SMTP server).

### DIYs

The access URLs:

App: UI http://its-rwams.ddev.site:5050/

phpMyAdmin UI: http://its-rwams.ddev.site:8036/

Mailpit: https://its-rwams.ddev.site:8026/


- **ToDo's**
    
  - Application flow
  - UML diagrams
  - Working TDD

  
