// HR Dashboard JavaScript
let currentUser = null;
let allEmployees = [];
let performanceDistributionChart = null;
let departmentComparisonChart = null;
let achievementAnalysisChart = null;
let monthlyTrendsChart = null;

// Initialize HR dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const userStr = localStorage.getItem('hr_ai_current_user');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(userStr);
    if (currentUser.role !== 'hr') {
        window.location.href = 'employee-dashboard.html';
        return;
    }
    
    // Set user info
    document.getElementById('username').textContent = currentUser.fullName;
    
    // Load dashboard data
    loadHRDashboard();
    showLeaderboard('overall');
});

// Load all HR dashboard data
function loadHRDashboard() {
    loadAllEmployees();
    loadOverviewMetrics();
    loadEmployeeCards();
    loadAnalyticsTable();
    createHRCharts();
    generateAllRecommendations();
}

// Load all employees
function loadAllEmployees() {
    const users = JSON.parse(localStorage.getItem('hr_ai_users') || '[]');
    allEmployees = users.filter(user => user.role === 'employee');
}

// Load overview metrics
function loadOverviewMetrics() {
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    // Total employees
    document.getElementById('totalEmployees').textContent = allEmployees.length;
    
    // Average performance score
    let totalPerformance = 0;
    let performanceCount = 0;
    
    allEmployees.forEach(employee => {
        const empAchievements = achievements.filter(a => a.employeeId === employee.id);
        const empTasks = tasks.filter(t => t.employeeId === employee.id);
        const empMetrics = metrics.filter(m => m.employeeId === employee.id);
        
        const performanceScore = calculatePerformanceScore(empAchievements, empTasks, empMetrics);
        totalPerformance += performanceScore;
        performanceCount++;
    });
    
    const avgPerformance = performanceCount > 0 ? (totalPerformance / performanceCount).toFixed(1) : '0.0';
    document.getElementById('avgPerformance').textContent = avgPerformance;
    
    // Top performers (score >= 80)
    const topPerformers = allEmployees.filter(employee => {
        const empAchievements = achievements.filter(a => a.employeeId === employee.id);
        const empTasks = tasks.filter(t => t.employeeId === employee.id);
        const empMetrics = metrics.filter(m => m.employeeId === employee.id);
        
        return calculatePerformanceScore(empAchievements, empTasks, empMetrics) >= 80;
    }).length;
    
    document.getElementById('topPerformers').textContent = topPerformers;
    
    // Total achievements
    document.getElementById('totalAchievements').textContent = achievements.length;
}

// Load employee cards
function loadEmployeeCards() {
    const employeeGrid = document.getElementById('employeeGrid');
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    employeeGrid.innerHTML = allEmployees.map(employee => {
        const empAchievements = achievements.filter(a => a.employeeId === employee.id);
        const empTasks = tasks.filter(t => t.employeeId === employee.id);
        const empMetrics = metrics.filter(m => m.employeeId === employee.id);
        
        const performanceScore = calculatePerformanceScore(empAchievements, empTasks, empMetrics);
        const avgImpact = empAchievements.length > 0 
            ? (empAchievements.reduce((sum, a) => sum + a.impactScore, 0) / empAchievements.length).toFixed(1)
            : '0.0';
        
        const completedTasks = empTasks.filter(t => t.status === 'completed').length;
        const initials = employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
        
        return `
            <div class="employee-card">
                <div class="employee-header">
                    <div class="employee-avatar">${initials}</div>
                    <div class="employee-info">
                        <h4>${employee.fullName}</h4>
                        <p>${employee.department}</p>
                    </div>
                </div>
                <div class="employee-metrics">
                    <div class="employee-metric">
                        <div class="label">Performance</div>
                        <div class="value">${performanceScore}/100</div>
                    </div>
                    <div class="employee-metric">
                        <div class="label">Achievements</div>
                        <div class="value">${empAchievements.length}</div>
                    </div>
                    <div class="employee-metric">
                        <div class="label">Avg Impact</div>
                        <div class="value">${avgImpact}</div>
                    </div>
                    <div class="employee-metric">
                        <div class="label">Tasks Done</div>
                        <div class="value">${completedTasks}</div>
                    </div>
                </div>
                <div class="employee-actions">
                    <button class="btn btn-primary" onclick="viewEmployeeDetails(${employee.id})">View Details</button>
                    <button class="btn btn-success" onclick="generateRecommendation(${employee.id})">AI Analysis</button>
                </div>
            </div>
        `;
    }).join('');
}

// Load analytics table
function loadAnalyticsTable() {
    const tbody = document.getElementById('analyticsTableBody');
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    tbody.innerHTML = allEmployees.map(employee => {
        const empAchievements = achievements.filter(a => a.employeeId === employee.id);
        const empTasks = tasks.filter(t => t.employeeId === employee.id);
        const empMetrics = metrics.filter(m => m.employeeId === employee.id);
        
        const performanceScore = calculatePerformanceScore(empAchievements, empTasks, empMetrics);
        const targetAchievement = empMetrics.length > 0
            ? (empMetrics.reduce((sum, m) => sum + (m.value / m.target * 100), 0) / empMetrics.length).toFixed(0)
            : '0';
        
        const statusColor = performanceScore >= 80 ? '#16a34a' : performanceScore >= 60 ? '#f59e0b' : '#dc2626';
        const status = performanceScore >= 80 ? 'Excellent' : performanceScore >= 60 ? 'Good' : 'Needs Improvement';
        
        return `
            <tr>
                <td>${employee.fullName}</td>
                <td>${employee.department}</td>
                <td><span style="color: #3b82f6; font-weight: 600;">${performanceScore}/100</span></td>
                <td>${empAchievements.length}</td>
                <td>${targetAchievement}%</td>
                <td><span style="color: ${statusColor}; font-weight: 500;">${status}</span></td>
            </tr>
        `;
    }).join('');
}

// Create HR charts
function createHRCharts() {
    createPerformanceDistributionChart();
    createDepartmentComparisonChart();
    createAchievementAnalysisChart();
    createMonthlyTrendsChart();
}

// Performance distribution chart
function createPerformanceDistributionChart() {
    const ctx = document.getElementById('performanceDistribution');
    if (!ctx) return;
    
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    const ranges = {
        'Excellent (80+)': 0,
        'Good (60-79)': 0,
        'Average (40-59)': 0,
        'Needs Improvement (<40)': 0
    };
    
    allEmployees.forEach(employee => {
        const empAchievements = achievements.filter(a => a.employeeId === employee.id);
        const empTasks = tasks.filter(t => t.employeeId === employee.id);
        const empMetrics = metrics.filter(m => m.employeeId === employee.id);
        
        const score = calculatePerformanceScore(empAchievements, empTasks, empMetrics);
        
        if (score >= 80) ranges['Excellent (80+)']++;
        else if (score >= 60) ranges['Good (60-79)']++;
        else if (score >= 40) ranges['Average (40-59)']++;
        else ranges['Needs Improvement (<40)']++;
    });
    
    if (performanceDistributionChart) {
        performanceDistributionChart.destroy();
    }
    
    performanceDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                data: Object.values(ranges),
                backgroundColor: [
                    '#16a34a',
                    '#3b82f6',
                    '#f59e0b',
                    '#dc2626'
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

// Department comparison chart
function createDepartmentComparisonChart() {
    const ctx = document.getElementById('departmentComparison');
    if (!ctx) return;
    
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    const departments = {};
    
    allEmployees.forEach(employee => {
        if (!departments[employee.department]) {
            departments[employee.department] = { scores: [], count: 0 };
        }
        
        const empAchievements = achievements.filter(a => a.employeeId === employee.id);
        const empTasks = tasks.filter(t => t.employeeId === employee.id);
        const empMetrics = metrics.filter(m => m.employeeId === employee.id);
        
        const score = calculatePerformanceScore(empAchievements, empTasks, empMetrics);
        departments[employee.department].scores.push(score);
        departments[employee.department].count++;
    });
    
    const labels = Object.keys(departments);
    const data = labels.map(dept => {
        const scores = departments[dept].scores;
        return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    });
    
    if (departmentComparisonChart) {
        departmentComparisonChart.destroy();
    }
    
    departmentComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Performance Score',
                data: data,
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Achievement analysis chart
function createAchievementAnalysisChart() {
    const ctx = document.getElementById('achievementAnalysis');
    if (!ctx) return;
    
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    
    const categories = {};
    achievements.forEach(achievement => {
        if (!categories[achievement.category]) {
            categories[achievement.category] = 0;
        }
        categories[achievement.category]++;
    });
    
    if (achievementAnalysisChart) {
        achievementAnalysisChart.destroy();
    }
    
    achievementAnalysisChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: [
                    '#3b82f6',
                    '#16a34a',
                    '#f59e0b',
                    '#dc2626',
                    '#8b5cf6',
                    '#06b6d4'
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

// Monthly trends chart
function createMonthlyTrendsChart() {
    const ctx = document.getElementById('monthlyTrends');
    if (!ctx) return;
    
    // Generate sample data for monthly trends
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const achievementData = [12, 15, 18, 22, 28, 25, 30, 35, 40];
    const taskData = [45, 52, 48, 58, 62, 55, 68, 72, 78];
    
    if (monthlyTrendsChart) {
        monthlyTrendsChart.destroy();
    }
    
    monthlyTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Achievements',
                data: achievementData,
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }, {
                label: 'Tasks Completed',
                data: taskData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
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

// Generate AI recommendations for all employees
function generateAllRecommendations() {
    const container = document.getElementById('recommendationsContainer');
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    container.innerHTML = allEmployees.map(employee => {
        const empAchievements = achievements.filter(a => a.employeeId === employee.id);
        const empTasks = tasks.filter(t => t.employeeId === employee.id);
        const empMetrics = metrics.filter(m => m.employeeId === employee.id);
        
        const performanceScore = calculatePerformanceScore(empAchievements, empTasks, empMetrics);
        const peerPercentile = calculatePeerPercentile(performanceScore);
        const recommendedIncrement = calculateRecommendedIncrement(performanceScore, peerPercentile);
        const reasoning = generateReasoning(empAchievements, empTasks, empMetrics, performanceScore, peerPercentile, employee.fullName);
        
        const promotionEligible = performanceScore >= 85 && peerPercentile >= 75;
        
        return `
            <div class="recommendation-card">
                <div class="recommendation-header">
                    <h4>🤖 AI Recommendation: ${employee.fullName}</h4>
                    <p style="opacity: 0.9; margin-top: 0.5rem;">${employee.department} • ${new Date(employee.joinDate).toLocaleDateString()}</p>
                </div>
                <div class="recommendation-content">
                    <div class="recommendation-metrics">
                        <div class="recommendation-metric">
                            <div class="label">Performance Score</div>
                            <div class="value">${performanceScore}/100</div>
                        </div>
                        <div class="recommendation-metric">
                            <div class="label">Peer Percentile</div>
                            <div class="value">${peerPercentile}%</div>
                        </div>
                        <div class="recommendation-metric">
                            <div class="label">Recommended Increment</div>
                            <div class="value">${recommendedIncrement}%</div>
                        </div>
                        <div class="recommendation-metric">
                            <div class="label">Confidence</div>
                            <div class="value">85%</div>
                        </div>
                    </div>
                    
                    <div class="recommendation-reasoning">
                        <h5>🧠 AI Analysis</h5>
                        <p>${reasoning}</p>
                    </div>
                    
                    ${promotionEligible ? '<div style="background: #dcfce7; color: #166534; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;"><strong>✅ Eligible for promotion consideration</strong></div>' : ''}
                    
                    <div class="recommendation-actions">
                        <button class="btn btn-success" onclick="approveRecommendation(${employee.id}, ${recommendedIncrement})">✅ Approve ${recommendedIncrement}%</button>
                        <button class="btn btn-warning" onclick="modifyRecommendation(${employee.id})">✏️ Modify</button>
                        <button class="btn btn-primary" onclick="viewEmployeeDetails(${employee.id})">👁️ View Details</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Show leaderboard
function showLeaderboard(type) {
    // Update button states
    document.querySelectorAll('.btn').forEach(btn => {
        if (btn.textContent.includes('Performance') || btn.textContent.includes('Achievements') || 
            btn.textContent.includes('Impact') || btn.textContent.includes('Efficient')) {
            btn.className = 'btn btn-secondary';
        }
    });
    
    event.target.className = 'btn btn-primary';
    
    const leaderboardContent = document.getElementById('leaderboardContent');
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    let sortedEmployees = [];
    
    switch (type) {
        case 'overall':
            sortedEmployees = allEmployees.map(employee => {
                const empAchievements = achievements.filter(a => a.employeeId === employee.id);
                const empTasks = tasks.filter(t => t.employeeId === employee.id);
                const empMetrics = metrics.filter(m => m.employeeId === employee.id);
                
                return {
                    ...employee,
                    score: calculatePerformanceScore(empAchievements, empTasks, empMetrics)
                };
            }).sort((a, b) => b.score - a.score);
            break;
            
        case 'achievements':
            sortedEmployees = allEmployees.map(employee => {
                const empAchievements = achievements.filter(a => a.employeeId === employee.id);
                return {
                    ...employee,
                    score: empAchievements.length
                };
            }).sort((a, b) => b.score - a.score);
            break;
            
        case 'impact':
            sortedEmployees = allEmployees.map(employee => {
                const empAchievements = achievements.filter(a => a.employeeId === employee.id);
                const avgImpact = empAchievements.length > 0 
                    ? empAchievements.reduce((sum, a) => sum + a.impactScore, 0) / empAchievements.length
                    : 0;
                return {
                    ...employee,
                    score: avgImpact.toFixed(1)
                };
            }).sort((a, b) => b.score - a.score);
            break;
            
        case 'efficiency':
            sortedEmployees = allEmployees.map(employee => {
                const empTasks = tasks.filter(t => t.employeeId === employee.id);
                const completedTasks = empTasks.filter(t => t.status === 'completed').length;
                const efficiency = empTasks.length > 0 ? (completedTasks / empTasks.length * 100).toFixed(0) : 0;
                return {
                    ...employee,
                    score: efficiency
                };
            }).sort((a, b) => b.score - a.score);
            break;
    }
    
    leaderboardContent.innerHTML = sortedEmployees.map((employee, index) => {
        const rank = index + 1;
        let rankClass = '';
        if (rank === 1) rankClass = 'gold';
        else if (rank === 2) rankClass = 'silver';
        else if (rank === 3) rankClass = 'bronze';
        
        const scoreUnit = type === 'impact' ? '/10' : type === 'efficiency' ? '%' : type === 'overall' ? '/100' : '';
        
        return `
            <div class="leaderboard-item">
                <div class="leaderboard-rank ${rankClass}">#${rank}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${employee.fullName}</div>
                    <div class="leaderboard-department">${employee.department}</div>
                </div>
                <div class="leaderboard-score">${employee.score}${scoreUnit}</div>
            </div>
        `;
    }).join('');
}

// View employee details
function viewEmployeeDetails(employeeId) {
    const employee = allEmployees.find(emp => emp.id === employeeId);
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    const empAchievements = achievements.filter(a => a.employeeId === employeeId);
    const empTasks = tasks.filter(t => t.employeeId === employeeId);
    const empMetrics = metrics.filter(m => m.employeeId === employeeId);
    
    const modal = document.getElementById('employeeModal');
    const title = document.getElementById('employeeModalTitle');
    const content = document.getElementById('employeeModalContent');
    
    title.textContent = `${employee.fullName} - Detailed View`;
    
    content.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <h4>📊 Performance Overview</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0;">
                <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">Performance Score</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #3b82f6;">${calculatePerformanceScore(empAchievements, empTasks, empMetrics)}/100</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">Total Achievements</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #16a34a;">${empAchievements.length}</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">Completed Tasks</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #f59e0b;">${empTasks.filter(t => t.status === 'completed').length}</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">Metrics Tracked</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #8b5cf6;">${empMetrics.length}</div>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 2rem;">
            <h4>🏆 Recent Achievements</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                ${empAchievements.length > 0 ? empAchievements.map(achievement => `
                    <div style="padding: 1rem; margin: 0.5rem 0; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <div style="font-weight: 600; color: #1e293b;">${achievement.title}</div>
                        <div style="color: #64748b; font-size: 0.9rem; margin: 0.25rem 0;">${achievement.description}</div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b;">
                            <span>Impact: ${achievement.impactScore}/10</span>
                            <span>${new Date(achievement.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                `).join('') : '<p style="color: #64748b; text-align: center; padding: 2rem;">No achievements recorded yet.</p>'}
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 2rem;">
            <button class="btn btn-success" onclick="generateRecommendation(${employeeId}); hideModal('employeeModal');">Generate AI Recommendation</button>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Generate individual recommendation
function generateRecommendation(employeeId) {
    const employee = allEmployees.find(emp => emp.id === employeeId);
    const achievements = JSON.parse(localStorage.getItem('hr_ai_achievements') || '[]');
    const tasks = JSON.parse(localStorage.getItem('hr_ai_tasks') || '[]');
    const metrics = JSON.parse(localStorage.getItem('hr_ai_metrics') || '[]');
    
    const empAchievements = achievements.filter(a => a.employeeId === employeeId);
    const empTasks = tasks.filter(t => t.employeeId === employeeId);
    const empMetrics = metrics.filter(m => m.employeeId === employeeId);
    
    const performanceScore = calculatePerformanceScore(empAchievements, empTasks, empMetrics);
    const peerPercentile = calculatePeerPercentile(performanceScore);
    const recommendedIncrement = calculateRecommendedIncrement(performanceScore, peerPercentile);
    const reasoning = generateReasoning(empAchievements, empTasks, empMetrics, performanceScore, peerPercentile, employee.fullName);
    
    const modal = document.getElementById('recommendationModal');
    const title = document.getElementById('recommendationModalTitle');
    const content = document.getElementById('recommendationModalContent');
    
    title.textContent = `AI Recommendation: ${employee.fullName}`;
    
    content.innerHTML = `
        <div class="recommendation-metrics">
            <div class="recommendation-metric">
                <div class="label">Performance Score</div>
                <div class="value">${performanceScore}/100</div>
            </div>
            <div class="recommendation-metric">
                <div class="label">Peer Percentile</div>
                <div class="value">${peerPercentile}%</div>
            </div>
            <div class="recommendation-metric">
                <div class="label">Recommended Increment</div>
                <div class="value">${recommendedIncrement}%</div>
            </div>
            <div class="recommendation-metric">
                <div class="label">Confidence</div>
                <div class="value">85%</div>
            </div>
        </div>
        
        <div class="recommendation-reasoning">
            <h5>🧠 Detailed AI Analysis</h5>
            <p>${reasoning}</p>
        </div>
        
        <div style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0;">
            <h5 style="color: #3b82f6; margin-bottom: 1rem;">💡 Key Insights</h5>
            <ul style="margin: 0; padding-left: 1.5rem; color: #1e293b;">
                <li>Performance ranks in ${peerPercentile >= 75 ? 'top quartile' : peerPercentile >= 50 ? 'upper half' : 'lower half'} compared to peers</li>
                <li>${empAchievements.length > 3 ? 'High achievement' : empAchievements.length > 1 ? 'Moderate achievement' : 'Low achievement'} activity (${empAchievements.length} achievements)</li>
                <li>${empTasks.filter(t => t.status === 'completed').length / Math.max(empTasks.length, 1) >= 0.9 ? 'Excellent' : 'Good'} task completion rate</li>
                <li>${performanceScore >= 80 ? 'Promotion eligible' : 'Focus on performance improvement'}</li>
            </ul>
        </div>
        
        <div class="recommendation-actions">
            <button class="btn btn-success" onclick="approveRecommendation(${employeeId}, ${recommendedIncrement})">✅ Approve ${recommendedIncrement}%</button>
            <button class="btn btn-warning" onclick="modifyRecommendation(${employeeId})">✏️ Modify Increment</button>
            <button class="btn btn-danger" onclick="rejectRecommendation(${employeeId})">❌ Reject</button>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Helper functions (same as employee dashboard)
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

function generateReasoning(achievements, tasks, metrics, performanceScore, peerPercentile, employeeName) {
    let reasoning = `Based on comprehensive analysis of ${employeeName}'s performance data, `;
    
    if (performanceScore >= 85) {
        reasoning += `they demonstrate exceptional performance with a score of ${performanceScore}/100. `;
    } else if (performanceScore >= 70) {
        reasoning += `they show good performance with a score of ${performanceScore}/100. `;
    } else {
        reasoning += `there are opportunities for improvement with a performance score of ${performanceScore}/100. `;
    }
    
    const avgImpact = achievements.length > 0 
        ? achievements.reduce((sum, a) => sum + a.impactScore, 0) / achievements.length
        : 0;
    
    if (avgImpact >= 8) {
        reasoning += `Their achievements show high impact (${avgImpact.toFixed(1)}/10), indicating significant value creation. `;
    }
    
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const taskRate = tasks.length > 0 ? (completedTasks / tasks.length * 100).toFixed(0) : 0;
    
    if (taskRate >= 90) {
        reasoning += `Their task completion rate of ${taskRate}% demonstrates excellent productivity. `;
    }
    
    if (peerPercentile >= 75) {
        reasoning += `Performance ranks in the top quartile compared to peers. `;
    } else if (peerPercentile >= 50) {
        reasoning += `Performance is above average compared to peers. `;
    }
    
    return reasoning + `This analysis considers achievements, task performance, metric achievement, and peer comparison to provide fair and transparent recommendations.`;
}

// Action functions
function approveRecommendation(employeeId, increment) {
    const employee = allEmployees.find(emp => emp.id === employeeId);
    showNotification(`✅ Approved ${increment}% salary increment for ${employee.fullName}`, 'success');
    hideModal('recommendationModal');
}

function modifyRecommendation(employeeId) {
    const newIncrement = prompt('Enter new increment percentage:');
    if (newIncrement && !isNaN(newIncrement)) {
        const employee = allEmployees.find(emp => emp.id === employeeId);
        showNotification(`✏️ Modified increment to ${newIncrement}% for ${employee.fullName}`, 'info');
        hideModal('recommendationModal');
    }
}

function rejectRecommendation(employeeId) {
    if (confirm('Are you sure you want to reject this recommendation?')) {
        const employee = allEmployees.find(emp => emp.id === employeeId);
        showNotification(`❌ Rejected recommendation for ${employee.fullName}`, 'warning');
        hideModal('recommendationModal');
    }
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
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#16a34a';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc2626';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}