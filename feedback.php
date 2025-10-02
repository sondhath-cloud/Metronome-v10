<?php
// Feedback form handler for Hathaway Metronome App
// This script processes feedback submissions and sends emails

// Set content type for JSON response
header('Content-Type: text/plain');

// Check if form was submitted via POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo 'error: Invalid request method';
    exit;
}

// Get form data and sanitize
$name = isset($_POST['name']) ? trim($_POST['name']) : 'Anonymous';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$message = isset($_POST['message']) ? trim($_POST['message']) : '';

// Validate required fields
if (empty($message)) {
    echo 'error: Message is required';
    exit;
}

if (empty($email)) {
    echo 'error: Email address is required';
    exit;
}

// Sanitize inputs to prevent XSS
$name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
$email = filter_var($email, FILTER_SANITIZE_EMAIL);
$message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo 'error: Invalid email format';
    exit;
}

// Set recipient email
$to = 'sondhath@gmail.com';

// Set subject
$subject = 'Metronome App Feedback - ' . date('Y-m-d H:i:s');

// Create email body
$emailBody = "New feedback received from the Hathaway Metronome App:\n\n";
$emailBody .= "Name: " . $name . "\n";
$emailBody .= "Email: " . $email . "\n";
$emailBody .= "Date: " . date('Y-m-d H:i:s') . "\n";
$emailBody .= "IP Address: " . $_SERVER['REMOTE_ADDR'] . "\n\n";
$emailBody .= "Message:\n";
$emailBody .= $message . "\n\n";
$emailBody .= "---\n";
$emailBody .= "This message was sent from the feedback form on your metronome app.";

// Set email headers
$headers = array();
$headers[] = 'From: Metronome App <noreply@' . $_SERVER['HTTP_HOST'] . '>';
$headers[] = 'Reply-To: ' . ($email ? $email : 'noreply@' . $_SERVER['HTTP_HOST']);
$headers[] = 'X-Mailer: PHP/' . phpversion();
$headers[] = 'Content-Type: text/plain; charset=UTF-8';

// Convert headers array to string
$headerString = implode("\r\n", $headers);

// Send email
$mailSent = mail($to, $subject, $emailBody, $headerString);

if ($mailSent) {
    echo 'success: Feedback sent successfully';
    
    // Optional: Log feedback to a file for backup
    $logEntry = date('Y-m-d H:i:s') . " - " . $name . " (" . ($email ? $email : 'no-email') . "): " . substr($message, 0, 100) . "...\n";
    file_put_contents('feedback_log.txt', $logEntry, FILE_APPEND | LOCK_EX);
} else {
    echo 'error: Failed to send feedback. Please try again later.';
}

// Optional: Store feedback in database (uncomment if you want to use MySQL)
/*
try {
    // Database connection (adjust these settings for your SiteWorks database)
    $host = 'localhost';
    $dbname = 'your_database_name';
    $username = 'your_username';
    $password = 'your_password';
    
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Insert feedback into database
    $stmt = $pdo->prepare("INSERT INTO feedback (name, email, message, created_at, ip_address) VALUES (?, ?, ?, NOW(), ?)");
    $stmt->execute([$name, $email, $message, $_SERVER['REMOTE_ADDR']]);
    
} catch (PDOException $e) {
    // Log database error but don't fail the email sending
    error_log("Database error in feedback.php: " . $e->getMessage());
}
*/
?>
