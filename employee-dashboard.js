// Employee Dashboard JavaScript
let currentUser = null;
let performanceChart = null;
let impactChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const userStr = localStorage.getItem('hr_ai_current_user');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(userStr);
    if (currentUser.role !== 'employee') {
        window.location.href = 'hr-dashboard.html';
        return;
    }
    
    // Set user info
    document.getElementById('username').textContent = currentUser.fullName;
    
    // Load dashboard data
    loadDashboardData();
    setupEventListeners();
    loadPerformanceAnalysis();
});

// Load all dashboard data
function loadDashboardData() {
    loadMetrics();
    loadAchievements();
    loadTasks();
    loadMetricsTable();
    createCharts();
}

// Load and display metrics
function loadMetrics() {
    const achievements = getEmployeeAchievements();
    const tasks = getEmployeeTasks();
    const metrics = getEmployeeMetrics();
    
    // Total achievements
    document.getElementById('totalAchievements').textContent = achievements.length;
    
    // Total completed tasks
    const completedTasks = tasks.filter(task => task.status === 'completed');
    document.getElementById('totalTasks').textContent = completedTasks.length;
    
    // Average impact score
    const avgImpact = achievements.length > 0 
        ? (achievements.reduce((sum, a) => sum + a.impactScore, 0) / achievements.length).toFixed(1)
        : '0.0';
    document.getElementById('avgImpact').textContent = avgImpact;
    
    // Target achievement percentage
    const avgTarget = metrics.length > 0
        ? (metrics.reduce((sum, m) => sum + (m.value / m.target * 100), 0) / metrics.length).toFixed(0)
        : '0';
    document.getElementById('targetAchievement').textContent = avgTarget + '%';
}

// Load achievements table
function loadAchievements() {
    const achievements = getEmployeeAchievements();
    const tbody = document.getElementById('achievementsTableBody');
    
    tbody.innerHTML = achievements.map(achievement => `
        <tr>
            <td>${achievement.title}</td>
            <td><span style="background: #e0f2fe; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${achievement.category}</span></td>
            <td><span style="color: #3b82f6; font-weight: 600;">${achievement.impactScore}/10</span></td>
            <td>${new Date(achievement.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="editAchievement(${achievement.id})">Edit</button>
                <button class="btn" style="background: #ef4444; color: white; padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-left: 0.25rem;" onclick="deleteAchievement(${achievement.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Load tasks table
function loadTasks() {
    const tasks = getEmployeeTasks();
    const tbody = document.getElementById('tasksTableBody');
    
    tbody.innerHTML = tasks.map(task => `
        <tr>
            <td>${task.title}</td>
            <td>${task.hoursSpent}h</td>
            <td><span class="status status-${task.status}">${task.status.replace('_', ' ')}</span></td>
            <td>${new Date(task.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="editTask(${task.id})">Edit</button>
                <button class="btn" style="background: #ef4444; color: white; padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-left: 0.25rem;" onclick="deleteTask(${task.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Load metrics table
function loadMetricsTable() {
    const metrics = getEmployeeMetrics();
    const tbody = document.getElementById('metricsTableBody');
    
    tbody.innerHTML = metrics.map(metric => {
        const achievement = metric.target > 0 ? (metric.value / metric.target * 100).toFixed(1) : '0';
        const achievementColor = achievement >= 100 ? '#16a34a' : achievement >= 80 ? '#f59e0b' : '#ef4444';
        
        return `
            <tr>
                <td>${metric.type}</td>
                <td>${metric.value}</td>
                <td>${metric.target}</td>
                <td><span style="color: ${achievementColor}; font-weight: 600;">${achievement}%</span></td>
                <td>${metric.month}/${metric.year}</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="editMetric(${metric.id})">Edit</button>
                    <button class="btn" style="background: #ef4444; color: white; padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-left: 0.25rem;" onclick="deleteMetric(${metric.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get employee data functions
function getEmployeeAchievements() {
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    return achievements.filter(a => a.employeeId === currentUser.id);
}

function getEmployeeTasks() {
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    return tasks.filter(t => t.employeeId === currentUser.id);
}

function getEmployeeMetrics() {
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    return metrics.filter(m => m.employeeId === currentUser.id);
}

// Create charts
function createCharts() {
    createPerformanceChart();
    createImpactChart();
}

// Performance chart
function createPerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    const metrics = getEmployeeMetrics();
    
    // Group metrics by month
    const monthlyData = {};
    metrics.forEach(metric => {
        const key = `${metric.year}-${metric.month.toString().padStart(2, '0')}`;
        if (!monthlyData[key]) {
            monthlyData[key] = { targets: [], values: [] };
        }
        monthlyData[key].targets.push(metric.target);
        monthlyData[key].values.push(metric.value);
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
    });
    
    const targetData = sortedMonths.map(month => {
        const data = monthlyData[month];
        return data.targets.reduce((sum, val) => sum + val, 0) / data.targets.length;
    });
    
    const actualData = sortedMonths.map(month => {
        const data = monthlyData[month];
        return data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
    });
    
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Target',
                data: targetData,
                borderColor: '#64748b',
                backgroundColor: 'rgba(100, 116, 139, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            }, {
                label: 'Actual',
                data: actualData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

// Impact chart
function createImpactChart() {
    const ctx = document.getElementById('impactChart');
    if (!ctx) return;
    
    const achievements = getEmployeeAchievements();
    
    // Categorize by impact score
    const categories = {
        'High Impact (8-10)': 0,
        'Medium Impact (5-7)': 0,
        'Low Impact (1-4)': 0
    };
    
    achievements.forEach(achievement => {
        const score = achievement.impactScore;
        if (score >= 8) {
            categories['High Impact (8-10)']++;
        } else if (score >= 5) {
            categories['Medium Impact (5-7)']++;
        } else {
            categories['Low Impact (1-4)']++;
        }
    });
    
    if (impactChart) {
        impactChart.destroy();
    }
    
    impactChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: [
                    '#10b981',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Event listeners
function setupEventListeners() {
    // Achievement form
    document.getElementById('achievementForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            id: Date.now(),
            employeeId: currentUser.id,
            title: document.getElementById('achievementTitle').value,
            category: document.getElementById('achievementCategory').value,
            description: document.getElementById('achievementDescription').value,
            impactScore: parseInt(document.getElementById('achievementImpact').value),
            date: document.getElementById('achievementDate').value
        };
        
        const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
        achievements.push(formData);
        localStorage.setItem('hr_ai_achievements', JSON.stringify(achievements));
        
        hideModal('achievementModal');
        document.getElementById('achievementForm').reset();
        loadDashboardData();
        showNotification('Achievement added successfully!', 'success');
    });
    
    // Task form
    document.getElementById('taskForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            id: Date.now(),
            employeeId: currentUser.id,
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            hoursSpent: parseFloat(document.getElementById('taskHours').value),
            status: document.getElementById('taskStatus').value,
            date: document.getElementById('taskDate').value
        };
        
        const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
        tasks.push(formData);
        localStorage.setItem('hr_ai_tasks', JSON.stringify(tasks));
        
        hideModal('taskModal');
        document.getElementById('taskForm').reset();
        loadDashboardData();
        showNotification('Task logged successfully!', 'success');
    });
    
    // Metric form
    document.getElementById('metricForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            id: Date.now(),
            employeeId: currentUser.id,
            type: document.getElementById('metricType').value,
            value: parseFloat(document.getElementById('metricValue').value),
            target: parseFloat(document.getElementById('metricTarget').value),
            month: parseInt(document.getElementById('metricMonth').value),
            year: parseInt(document.getElementById('metricYear').value)
        };
        
        const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
        metrics.push(formData);
        localStorage.setItem('hr_ai_metrics', JSON.stringify(metrics));
        
        hideModal('metricModal');
        document.getElementById('metricForm').reset();
        loadDashboardData();
        showNotification('Metric added successfully!', 'success');
    });
}

// Load AI performance analysis
function loadPerformanceAnalysis() {
    const analysisContainer = document.getElementById('performanceAnalysisContent');
    
    const achievements = getEmployeeAchievements();
    const tasks = getEmployeeTasks();
    const metrics = getEmployeeMetrics();
    
    // Calculate performance metrics
    const performanceScore = calculatePerformanceScore(achievements, tasks, metrics);
    const peerPercentile = calculatePeerPercentile(performanceScore);
    const recommendedIncrement = calculateRecommendedIncrement(performanceScore, peerPercentile);
    const reasoning = generateReasoning(achievements, tasks, metrics, performanceScore, peerPercentile);
    
    analysisContainer.innerHTML = `
        <div class="performance-analysis">
            <h3>🤖 AI Performance Analysis for ${currentUser.fullName}</h3>
            
            <div class="performance-metrics">
                <div class="performance-metric">
                    <div class="label">Performance Score</div>
                    <div class="value">${performanceScore}/100</div>
                </div>
                <div class="performance-metric">
                    <div class="label">Peer Ranking</div>
                    <div class="value">${peerPercentile}%</div>
                </div>
                <div class="performance-metric">
                    <div class="label">Recommended Increment</div>
                    <div class="value">${recommendedIncrement}%</div>
                </div>
                <div class="performance-metric">
                    <div class="label">Career Trajectory</div>
                    <div class="value">${performanceScore >= 85 ? '📈 Excellent' : performanceScore >= 70 ? '📊 Good' : '📉 Needs Improvement'}</div>
                </div>
            </div>
            
            <div class="ai-reasoning">
                <h4>🧠 AI Analysis Reasoning</h4>
                <p>${reasoning}</p>
            </div>
            
            <div class="recommendations-list">
                <h4>💡 Improvement Recommendations</h4>
                <ul>
                    ${generateRecommendations(achievements, tasks, metrics, performanceScore).map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            
            ${performanceScore >= 85 ? '<div style="background: #dcfce7; color: #166534; padding: 1rem; border-radius: 8px; margin-top: 1rem; text-align: center;"><strong>🎉 Congratulations! You are eligible for promotion consideration!</strong></div>' : ''}
        </div>
    `;
}

// AI calculation functions
function calculatePerformanceScore(achievements, tasks, metrics) {
    let score = 0;
    
    // Achievement impact (40%)
    const avgImpact = achievements.length > 0 
        ? achievements.reduce((sum, a) => sum + a.impactScore, 0) / achievements.length
        : 0;
    score += (avgImpact / 10) * 40;
    
    // Task completion (30%)
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const taskCompletionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;
    score += taskCompletionRate * 30;
    
    // Metric achievement (30%)
    const avgMetricAchievement = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.value / m.target), 0) / metrics.length
        : 0;
    score += Math.min(avgMetricAchievement, 1) * 30;
    
    return Math.round(score);
}

function calculatePeerPercentile(performanceScore) {
    // Simulate peer comparison (in real app, this would compare against all employees)
    return Math.round(50 + (performanceScore - 70) * 1.5);
}

function calculateRecommendedIncrement(performanceScore, peerPercentile) {
    let increment = 3; // Base increment
    
    if (performanceScore >= 90) increment += 12;
    else if (performanceScore >= 80) increment += 8;
    else if (performanceScore >= 70) increment += 5;
    else if (performanceScore >= 60) increment += 2;
    
    if (peerPercentile >= 90) increment += 3;
    else if (peerPercentile >= 75) increment += 1;
    else if (peerPercentile <= 25) increment -= 1;
    
    return Math.max(increment, 0);
}

function generateReasoning(achievements, tasks, metrics, performanceScore, peerPercentile) {
    let reasoning = `Based on comprehensive analysis of your performance data, `;
    
    if (performanceScore >= 85) {
        reasoning += `you demonstrate exceptional performance with a score of ${performanceScore}/100. `;
    } else if (performanceScore >= 70) {
        reasoning += `you show good performance with a score of ${performanceScore}/100. `;
    } else {
        reasoning += `there are opportunities for improvement with a performance score of ${performanceScore}/100. `;
    }
    
    const avgImpact = achievements.length > 0 
        ? achievements.reduce((sum, a) => sum + a.impactScore, 0) / achievements.length
        : 0;
    
    if (avgImpact >= 8) {
        reasoning += `Your achievements show high impact (${avgImpact.toFixed(1)}/10), indicating significant value creation. `;
    }
    
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const taskRate = tasks.length > 0 ? (completedTasks / tasks.length * 100).toFixed(0) : 0;
    
    if (taskRate >= 90) {
        reasoning += `Your task completion rate of ${taskRate}% demonstrates excellent productivity. `;
    }
    
    if (peerPercentile >= 75) {
        reasoning += `Your performance ranks in the top quartile compared to peers. `;
    } else if (peerPercentile >= 50) {
        reasoning += `Your performance is above average compared to peers. `;
    }
    
    return reasoning + `This analysis considers your achievements, task performance, metric achievement, and peer comparison to provide fair and transparent recommendations.`;
}

function generateRecommendations(achievements, tasks, metrics, performanceScore) {
    const recommendations = [];
    
    const avgImpact = achievements.length > 0 
        ? achievements.reduce((sum, a) => sum + a.impactScore, 0) / achievements.length
        : 0;
    
    if (avgImpact < 7) {
        recommendations.push("Focus on high-impact projects that demonstrate significant value to the organization");
    }
    
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const taskRate = tasks.length > 0 ? completedTasks / tasks.length : 0;
    
    if (taskRate < 0.9) {
        recommendations.push("Improve task completion rate through better time management and prioritization");
    }
    
    if (metrics.length < 3) {
        recommendations.push("Track more quantitative metrics to demonstrate measurable impact");
    }
    
    if (achievements.length < 3) {
        recommendations.push("Document more achievements to showcase your contributions");
    }
    
    if (performanceScore >= 85) {
        recommendations.push("Continue excellent performance and consider mentoring junior team members");
        recommendations.push("Explore leadership opportunities and cross-functional projects");
    } else if (performanceScore >= 70) {
        recommendations.push("Seek feedback from supervisors to identify areas for growth");
        recommendations.push("Consider additional training or certification in your field");
    } else {
        recommendations.push("Work closely with your manager to create a performance improvement plan");
        recommendations.push("Focus on completing current tasks before taking on new responsibilities");
    }
    
    return recommendations;
}

// UI helper functions
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Add active class to clicked nav link
    event.target.classList.add('active');
    
    // Reload performance analysis if switching to that section
    if (sectionId === 'performance') {
        loadPerformanceAnalysis();
    }
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function logout() {
    localStorage.removeItem('hr_ai_current_user');
    window.location.href = 'index.html';
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 6px;
        color: white;
        z-index: 1000;
        font-weight: 500;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#16a34a';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#dc2626';
    } else {
        notification.style.backgroundColor = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// Edit and delete functions (simplified for demo)
function editAchievement(id) {
    showNotification('Edit functionality would be implemented here', 'info');
}

function deleteAchievement(id) {
    if (confirm('Are you sure you want to delete this achievement?')) {
        const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
        const updated = achievements.filter(a => a.id !== id);
        localStorage.setItem('hr_ai_achievements', JSON.stringify(updated));
        loadDashboardData();
        showNotification('Achievement deleted successfully', 'success');
    }
}

function editTask(id) {
    showNotification('Edit functionality would be implemented here', 'info');
}

function deleteTask(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
        const updated = tasks.filter(t => t.id !== id);
        localStorage.setItem('hr_ai_tasks', JSON.stringify(updated));
        loadDashboardData();
        showNotification('Task deleted successfully', 'success');
    }
}

function editMetric(id) {
    showNotification('Edit functionality would be implemented here', 'info');
}

function deleteMetric(id) {
    if (confirm('Are you sure you want to delete this metric?')) {
        const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
        const updated = metrics.filter(m => m.id !== id);
        localStorage.setItem('hr_ai_metrics', JSON.stringify(updated));
        loadDashboardData();
        showNotification('Metric deleted successfully', 'success');
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}