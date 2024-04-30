document.getElementById('switch').addEventListener('click', function() {
    document.getElementById('status').textContent = 'Running';
    document.getElementById('cpuUsage').textContent = '50%';
    document.getElementById('memoryUsage').textContent = '2GB';
    // Mock fetch call to start instance
    // fetch('/api/start-instance', { method: 'POST' })
    // .then(response => response.json())
    // .then(data => console.log(data));
});

document.getElementById('switch').addEventListener('click', function() {
    document.getElementById('status').textContent = 'Stopped';
    document.getElementById('cpuUsage').textContent = '0%';
    document.getElementById('memoryUsage').textContent = '0GB';
    // Mock fetch call to stop instance
    // fetch('/api/stop-instance', { method: 'POST' })
    // .then(response => response.json())
    // .then(data => console.log(data));
});
