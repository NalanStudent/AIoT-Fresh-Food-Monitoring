document.addEventListener('DOMContentLoaded', function() {

    const devicesContainer = document.getElementById('devices-container');
    const modal = document.getElementById('threshold-modal');
    const modalCloseButton = document.querySelector('.close-button');
    const thresholdForm = document.getElementById('threshold-form');
    let currentEditingDeviceId = null;

    const API_BASE_URL = window.location.origin;

    // --- Main function to fetch and render devices ---
    async function loadDevices() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/devices`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            renderDevices(data.devices);
        } catch (error) {
            console.error("Failed to load devices:", error);
            devicesContainer.innerHTML = '<p>Error loading devices. Please check the console.</p>';
        }
    }

    // --- Render all device cards ---
    function renderDevices(devices) {
        if (!devices || devices.length === 0) {
            devicesContainer.innerHTML = '<p>No devices found.</p>';
            return;
        }

        devices.forEach(device => {
            let card = document.getElementById(`device-${device.device_id}`);
            if (!card) {
                card = document.createElement('div');
                card.className = 'device-card';
                card.id = `device-${device.device_id}`;
                devicesContainer.appendChild(card);
            }
            card.innerHTML = createDeviceCardHTML(device);
        });
        
        attachEventListeners();
    }
    
    // --- Generate HTML for a single device card ---
    function createDeviceCardHTML(device) {
        const isOnline = device.status === 'online';
        const statusClass = isOnline ? 'online' : 'offline';
        const telemetry = device.last_telemetry || {};
        
        return `
            <div class="device-card-header">
                <div>
                    <span class="device-id">${device.device_id}</span>
                    <div style="font-size: 0.9em; color: #aaa;">Type: ${device.selected_food_type || 'N/A'}</div>
                </div>
                <span class="status-dot status-${statusClass}" title="${isOnline ? 'Online' : 'Offline'}"></span>
            </div>
            <div class="telemetry-grid">
                <div class="telemetry-item">
                    <div class="telemetry-item-label">Temperature</div>
                    <div class="telemetry-item-value">${telemetry.temperature_c?.toFixed(1) ?? 'N/A'} °C</div>
                </div>
                <div class="telemetry-item">
                    <div class="telemetry-item-label">Humidity</div>
                    <div class="telemetry-item-value">${telemetry.humidity_pct?.toFixed(0) ?? 'N/A'} %</div>
                </div>
                <div class="telemetry-item">
                    <div class="telemetry-item-label">Methane (MQ4)</div>
                    <div class="telemetry-item-value">${telemetry.mq4_ppm?.toFixed(0) ?? 'N/A'} ppm</div>
                </div>
                <div class="telemetry-item">
                    <div class="telemetry-item-label">GPS Satellites</div>
                    <div class="telemetry-item-value">${telemetry.gps?.satellites ?? 'N/A'}</div>
                </div>
            </div>
            <div class="section-title">Alerts</div>
            <div class="alerts-list" id="alerts-${device.device_id}">Loading alerts...</div>
            <div class="card-actions">
                <button class="edit-thresholds-btn" data-device-id="${device.device_id}">Edit Config</button>
                <button class="test-alert-btn" data-device-id="${device.device_id}">Test Alert</button>
                <button class="clear-alerts-btn" data-device-id="${device.device_id}">Clear Alerts</button>
            </div>
        `;
    }

    // --- Load alerts for all visible devices ---
    async function loadAllAlerts() {
        const devices = document.querySelectorAll('.device-card');
        devices.forEach(card => {
            const deviceId = card.id.replace('device-', '');
            loadAlertsForDevice(deviceId);
        });
    }

    // --- Load and render alerts for a single device ---
    async function loadAlertsForDevice(deviceId) {
        const alertsContainer = document.getElementById(`alerts-${deviceId}`);
        if (!alertsContainer) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/alerts`);
            const data = await response.json();
            
            if (data.alerts && data.alerts.length > 0) {
                alertsContainer.innerHTML = data.alerts.map(alert => `
                    <div class="alert-item alert-${alert.level}">
                        <strong>${alert.level.toUpperCase()}:</strong> ${alert.message}
                        <div style="font-size: 0.8em; color: #999;">${new Date(alert.timestamp).toLocaleString()}</div>
                    </div>
                `).join('');
            } else {
                alertsContainer.innerHTML = 'No recent alerts.';
            }
        } catch (error) {
            console.error(`Failed to load alerts for ${deviceId}:`, error);
            alertsContainer.innerHTML = 'Error loading alerts.';
        }
    }
    
    // --- Attach event listeners to buttons ---
    function attachEventListeners() {
        document.querySelectorAll('.edit-thresholds-btn').forEach(button => {
            button.onclick = (e) => handleEditThresholds(e.target.dataset.deviceId);
        });
        document.querySelectorAll('.test-alert-btn').forEach(button => {
            button.onclick = (e) => handleTestAlert(e.target.dataset.deviceId);
        });
        document.querySelectorAll('.clear-alerts-btn').forEach(button => {
            button.onclick = (e) => handleClearAlerts(e.target.dataset.deviceId);
        });
    }

    // --- Handle opening the threshold edit modal ---
    async function handleEditThresholds(deviceId) {
        currentEditingDeviceId = deviceId;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`);
            const data = await response.json();
            const device = data.device;
            
            // Populate form
            document.getElementById('food-type').value = device.selected_food_type || '';
            const overrides = device.threshold_overrides || {};
            document.getElementById('temp-warn').value = overrides.temperature?.warn || '';
            document.getElementById('temp-crit').value = overrides.temperature?.critical || '';
            document.getElementById('hum-low').value = overrides.humidity?.warn_low || '';
            document.getElementById('hum-high').value = overrides.humidity?.warn_high || '';
            document.getElementById('mq4-warn').value = overrides.mq4?.warn || '';
            document.getElementById('mq4-crit').value = overrides.mq4?.critical || '';
            
            modal.style.display = 'block';
        } catch (error) {
            console.error(`Failed to get device details for ${deviceId}:`, error);
            alert('Could not load device details to edit thresholds.');
        }
    }

    // --- Handle sending a test alert ---
    async function handleTestAlert(deviceId) {
        if (!confirm(`Send a test alert for ${deviceId}?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/test-alert`, { method: 'POST' });
            if (!response.ok) {
                throw new Error('Server responded with an error.');
            }
            alert('Test alert sent successfully!');
            // Refresh alerts for this device after a short delay
            setTimeout(() => loadAlertsForDevice(deviceId), 1000);
        } catch (error) {
            console.error(`Failed to send test alert for ${deviceId}:`, error);
            alert('Failed to send test alert.');
        }
    }

    // --- Handle clearing alerts for a device ---
    async function handleClearAlerts(deviceId) {
        if (!confirm(`Are you sure you want to clear all alerts for ${deviceId}? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/alerts`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Server responded with an error.');
            }
            
            alert('Alerts cleared successfully!');
            loadAlertsForDevice(deviceId); // Refresh the alerts list
        } catch (error) {
            console.error(`Failed to clear alerts for ${deviceId}:`, error);
            alert('Failed to clear alerts.');
        }
    }

    // --- Modal close handler ---
    modalCloseButton.onclick = () => {
        modal.style.display = 'none';
    };
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
    
    // --- Threshold form submission handler ---
    thresholdForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const payload = {
            selected_food_type: document.getElementById('food-type').value,
            threshold_overrides: {
                temperature: {
                    warn: parseFloat(document.getElementById('temp-warn').value) || null,
                    critical: parseFloat(document.getElementById('temp-crit').value) || null,
                },
                humidity: {
                    warn_low: parseFloat(document.getElementById('hum-low').value) || null,
                    warn_high: parseFloat(document.getElementById('hum-high').value) || null,
                },
                mq4: {
                    warn: parseFloat(document.getElementById('mq4-warn').value) || null,
                    critical: parseFloat(document.getElementById('mq4-crit').value) || null,
                }
            }
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/devices/${currentEditingDeviceId}/thresholds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Server responded with an error.');
            }
            
            modal.style.display = 'none';
            alert('Configuration updated successfully!');
            // Reload devices to show the new food type instantly
            loadDevices();
        } catch (error) {
            console.error(`Failed to update thresholds for ${currentEditingDeviceId}:`, error);
            alert('Failed to update thresholds.');
        }
    };

    // --- Function to update the UTC clock ---
    function updateUtcClock() {
        const utcClockElement = document.getElementById('utc-clock');
        if (utcClockElement) {
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).padStart(2, '0');
            const hours = String(now.getUTCHours()).padStart(2, '0');
            const minutes = String(now.getUTCMinutes()).padStart(2, '0');
            const seconds = String(now.getUTCSeconds()).padStart(2, '0');
            utcClockElement.innerText = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
        }
    }
    
    // --- Initial Load & Periodic Refresh ---
    async function initialLoad() {
        await loadDevices();
        await loadAllAlerts();
    }

    initialLoad();
    setInterval(initialLoad, 10000); // Refresh every 10 seconds
    setInterval(updateUtcClock, 1000); // Update UTC clock every second
});
