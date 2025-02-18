// JavaScript for Tabs Functionality
document.addEventListener('DOMContentLoaded', function () {
    const tabs = document.querySelectorAll('nav ul li a');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();

            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to the clicked tab and corresponding content
            this.classList.add('active');
            const target = this.getAttribute('href').substring(1);
            document.getElementById(target).classList.add('active');
        });
    });

    // Fetch latest YouTube video on page load
    fetchLatestVideo();
});

// EMI Calculator Function
function calculateEMI() {
    const principal = parseFloat(document.getElementById('principal').value);
    const rate = parseFloat(document.getElementById('rate').value) / 100 / 12; // Monthly interest rate
    const time = parseInt(document.getElementById('time').value) * 12; // Convert years to months
    
    if (isNaN(principal) || isNaN(rate) || isNaN(time) || principal <= 0 || rate <= 0 || time <= 0) {
        document.getElementById('emi-result').textContent = "Please enter valid values.";
        return;
    }

    const emi = (principal * rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
    document.getElementById('emi-result').textContent = `Your EMI is ₹${emi.toFixed(2)}`;
}

// Scientific Calculator Functions
let calcInput = document.getElementById('calc-input');

// Append input value
function appendToInput(value) {
    calcInput.value += value;
}

// Calculate result
function calculateResult() {
    try {
        calcInput.value = eval(calcInput.value);
    } catch (e) {
        calcInput.value = 'Error';
    }
}

// Clear input field
function clearInput() {
    calcInput.value = '';
}

// Drawing Board Functionality
let canvas = document.getElementById('drawing-board');
let ctx = canvas.getContext('2d');

let drawing = false;
let lastX = 0;
let lastY = 0;

// Start drawing
canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

// Draw on mouse move
canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

// Stop drawing on mouse up
canvas.addEventListener('mouseup', () => {
    drawing = false;
});

// Clear canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

document.getElementById('contact-form').addEventListener('submit', function (e) {
    e.preventDefault();

    var name = document.getElementById('name').value;
    var email = document.getElementById('email').value;
    var phone = document.getElementById('phone').value;
    var subject = document.getElementById('subject').value;
    var message = document.getElementById('message').value;

    // Create mailto link
    var mailtoLink = `mailto:programpros7@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        `Name: ${name}%0D%0AEmail: ${email}%0D%0APhone: ${phone}%0D%0A%0D%0A${message}`
    )}`;

    // Open the email client
    window.location.href = mailtoLink;
});
// Initialize CodeMirror Editor with Dark Luxury Blue Theme
var editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
    mode: "htmlmixed",
    theme: "dracula",
    lineNumbers: true,
    autoCloseTags: true,
    autoCloseBrackets: true
});

// Function to Run Code
function runCode() {
    let code = editor.getValue();
    let iframe = document.getElementById("output-frame").contentWindow.document;
    iframe.open();
    iframe.write(code);
    iframe.close();
}

// Function to Save as HTML File
function saveAsHTML() {
    let code = editor.getValue();
    let blob = new Blob([code], { type: "text/html" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my_code.html";
    a.click();
}
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}
const darkModeBtn = document.getElementById('dark-mode-btn');
const lightModeBtn = document.getElementById('light-mode-btn');
const body = document.body;

// Check the user's saved theme preference and apply it
if (localStorage.getItem('theme') === 'dark') {
  body.classList.add('dark-mode');
}

darkModeBtn.addEventListener('click', () => {
  body.classList.add('dark-mode');
  localStorage.setItem('theme', 'dark');  // Save dark mode preference
});

lightModeBtn.addEventListener('click', () => {
  body.classList.remove('dark-mode');
  localStorage.setItem('theme', 'light');  // Save light mode preference
});
