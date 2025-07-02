require('dotenv').config();
console.log('Loaded environment variables:', {
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    DB_NAME: process.env.SECONDARY_DB_NAME
});
// This script is used to test database connectivity and execute SQL queries from the command line.
const mysql = require('mysql2');
const readline = require('readline');

// Debug: Log connection parameters
console.log('Connecting to database with the following settings:');
console.log({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.SECONDARY_DB_NAME
});

// Create a direct database connection
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.SECONDARY_DB_NAME
});

// Test database connection
connection.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
    console.log('✅ Database connection successful!');
    promptQuery();
});

// Readline interface for CLI input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Execute a query
function executeQuery(query) {
    connection.query(query, (err, results) => {
        if (err) {
            console.error('❌ Query execution failed:', err.message);
        } else {
            console.log('✅ Query executed successfully!');
            console.table(results);
        }
        promptQuery();
    });
}

// CLI prompt for user input
function promptQuery() {
    rl.question('Enter SQL query (or type "exit" to quit): ', (query) => {
        if (query.toLowerCase() === 'exit') {
            console.log('Exiting...');
            connection.end();
            rl.close();
            process.exit(0);
        }
        executeQuery(query);
    });
}