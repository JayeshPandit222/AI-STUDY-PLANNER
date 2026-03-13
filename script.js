document.addEventListener('DOMContentLoaded', () => {

    /* ========================================
       WELCOME PAGE - Particles & Transition
       ======================================== */

    const welcomePage = document.getElementById('welcome-page');
    const appPage = document.getElementById('app-page');
    const getStartedBtn = document.getElementById('get-started-btn');
    const generatePlanBtn = document.getElementById('generate-plan-btn');
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');

    // --- Particle System ---
    let particles = [];
    let animFrameId;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.4 + 0.1;
            this.hue = Math.random() > 0.5 ? 263 : 187;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 70%, 60%, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 15000));
        for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    function drawLines() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 110) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(124, 58, 237, ${0.06 * (1 - dist / 110)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        drawLines();
        animFrameId = requestAnimationFrame(animateParticles);
    }

    initParticles();
    animateParticles();

    // --- Shared State ---
    let plannerInitialized = false;
    let studyData = {
        schedule: [],
        subjects: [],
        daysLeft: 0,
        dailyHours: 0,
        totalReqHours: 0,
        totalAvailHours: 0,
        checkedDays: {} // { dayIndex: true }
    };

    // Load checked days from localStorage
    try {
        const saved = localStorage.getItem('studysync_checked');
        if (saved) studyData.checkedDays = JSON.parse(saved);
    } catch (e) {}

    // --- Page Transition ---
    function transitionToApp() {
        welcomePage.classList.add('exit');
        setTimeout(() => {
            welcomePage.style.display = 'none';
            cancelAnimationFrame(animFrameId);
            appPage.classList.remove('hidden');
            appPage.classList.add('fade-in');
            if (!plannerInitialized) {
                initPlanner();
                plannerInitialized = true;
            }
        }, 600);
    }

    getStartedBtn.addEventListener('click', transitionToApp);
    generatePlanBtn.addEventListener('click', transitionToApp);

    // Navbar logo and back button -> go back to welcome
    const navLogo = document.getElementById('nav-logo');
    const navBackBtn = document.getElementById('nav-back-btn');
    
    function goBackToWelcome(e) {
        if (e) e.preventDefault();
        appPage.classList.add('hidden');
        appPage.classList.remove('fade-in');
        welcomePage.style.display = '';
        welcomePage.classList.remove('exit');
        initParticles();
        animateParticles();
    }

    navLogo.addEventListener('click', goBackToWelcome);
    navBackBtn.addEventListener('click', goBackToWelcome);

    /* ========================================
       NAV TAB SWITCHING
       ======================================== */

    const plannerPage = document.querySelector('.container:not(.dashboard-container)');
    const dashboardPage = document.getElementById('dashboard-page');
    const navTabPlanner = document.getElementById('nav-tab-planner');
    const navTabDashboard = document.getElementById('nav-tab-dashboard');
    const goToDashboardBtn = document.getElementById('go-to-dashboard-btn');

    function switchToPage(pageName) {
        if (pageName === 'planner') {
            plannerPage.classList.remove('hidden');
            dashboardPage.classList.add('hidden');
            navTabPlanner.classList.add('active');
            navTabDashboard.classList.remove('active');
        } else {
            plannerPage.classList.add('hidden');
            dashboardPage.classList.remove('hidden');
            navTabPlanner.classList.remove('active');
            navTabDashboard.classList.add('active');
            updateDashboard();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    navTabPlanner.addEventListener('click', () => switchToPage('planner'));
    navTabDashboard.addEventListener('click', () => switchToPage('dashboard'));
    goToDashboardBtn.addEventListener('click', () => switchToPage('dashboard'));

    /* ========================================
       MAIN PLANNER APP
       ======================================== */

    function initPlanner() {
        const form = document.getElementById('planner-form');
        const examDateInput = document.getElementById('exam-date');
        const addSubjectBtn = document.getElementById('add-subject-btn');
        const subjectsContainer = document.getElementById('subjects-container');
        const resultSection = document.getElementById('result-section');
        const messagesContainer = document.getElementById('messages-container');
        const timetableContainer = document.getElementById('timetable-container');
        const daysLeftDisplay = document.getElementById('days-left');
        const totalAvailDisplay = document.getElementById('total-hours-avail');
        const totalReqDisplay = document.getElementById('total-hours-req');

        const COLOR_PALETTE = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#f97316'];
        let subjectCount = 0;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        examDateInput.min = tomorrow.toISOString().split('T')[0];

        addSubject();
        addSubjectBtn.addEventListener('click', addSubject);

        function addSubject() {
            const id = `subject-${Date.now()}`;
            const color = COLOR_PALETTE[subjectCount % COLOR_PALETTE.length];
            const subjectDiv = document.createElement('div');
            subjectDiv.className = 'subject-item';
            subjectDiv.id = id;
            subjectDiv.innerHTML = `
                <input type="text" placeholder="e.g. Mathematics" class="subject-name" required>
                <input type="number" placeholder="Hours" class="subject-hours" min="1" required>
                <button type="button" class="btn-icon" onclick="removeSubject('${id}')" title="Remove Subject">
                    <i class="ri-delete-bin-line"></i>
                </button>
            `;
            subjectDiv.dataset.color = color;
            subjectsContainer.appendChild(subjectDiv);
            subjectCount++;
        }

        window.removeSubject = function (id) {
            if (subjectsContainer.children.length > 1) {
                const el = document.getElementById(id);
                el.style.opacity = '0';
                el.style.transform = 'translateX(-10px)';
                setTimeout(() => el.remove(), 200);
            } else {
                showMessage('error', 'You must have at least one subject.');
            }
        };

        function showMessage(type, text) {
            messagesContainer.innerHTML = '';
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${type}`;
            let icon = 'ri-information-line';
            if (type === 'warning') icon = 'ri-alert-line';
            if (type === 'success') icon = 'ri-checkbox-circle-line';
            if (type === 'error') icon = 'ri-error-warning-line';
            msgDiv.innerHTML = `<i class="${icon}"></i><div>${text}</div>`;
            messagesContainer.appendChild(msgDiv);
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const examDateVal = new Date(examDateInput.value);
            const dailyHours = parseFloat(document.getElementById('daily-hours').value);
            const subjects = [];
            let totalReqHours = 0;

            document.querySelectorAll('.subject-item').forEach(item => {
                const name = item.querySelector('.subject-name').value;
                const hours = parseFloat(item.querySelector('.subject-hours').value);
                const color = item.dataset.color;
                subjects.push({ name, hoursLeft: hours, totalHours: hours, color });
                totalReqHours += hours;
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            examDateVal.setHours(0, 0, 0, 0);
            const timeDiff = examDateVal.getTime() - today.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

            if (daysLeft <= 0) {
                showMessage('error', 'Exam date must be in the future.');
                return;
            }

            const totalAvailHours = daysLeft * dailyHours;

            animateNumber(daysLeftDisplay, daysLeft);
            animateNumber(totalAvailDisplay, totalAvailHours);
            animateNumber(totalReqDisplay, totalReqHours);

            resultSection.classList.remove('hidden');
            timetableContainer.innerHTML = '';
            messagesContainer.innerHTML = '';

            if (totalReqHours > totalAvailHours) {
                showMessage('warning', `You need ${totalReqHours} hours but only have ${totalAvailHours} hours available. Consider adding more daily study hours!`);
            } else if (totalReqHours < totalAvailHours * 0.5) {
                showMessage('success', `Great news! You only need ${totalReqHours} out of ${totalAvailHours} available hours.`);
            }

            // Generate Timetable
            const schedule = [];
            const queue = JSON.parse(JSON.stringify(subjects));
            let currentDate = new Date(today);

            for (let d = 0; d < daysLeft; d++) {
                let dailyRemaining = dailyHours;
                const dayTasks = [];
                let attempts = queue.length * 2;

                while (dailyRemaining > 0 && queue.length > 0 && attempts > 0) {
                    const currentSubject = queue.shift();
                    const maxChunk = 2;
                    let take = Math.min(maxChunk, dailyRemaining, currentSubject.hoursLeft);
                    if (currentSubject.hoursLeft <= maxChunk && currentSubject.hoursLeft <= dailyRemaining) {
                        take = currentSubject.hoursLeft;
                    }
                    if (take > 0) {
                        dayTasks.push({ title: currentSubject.name, duration: take, color: currentSubject.color });
                        dailyRemaining -= take;
                        currentSubject.hoursLeft -= take;
                    }
                    if (currentSubject.hoursLeft > 0.01) queue.push(currentSubject);
                    attempts--;
                }

                if (dayTasks.length > 0) {
                    schedule.push({ date: new Date(currentDate), tasks: consolidateTasks(dayTasks) });
                }
                currentDate.setDate(currentDate.getDate() + 1);
                if (queue.length === 0) break;
            }

            // Save to shared state for dashboard
            studyData.schedule = schedule;
            studyData.subjects = subjects;
            studyData.daysLeft = daysLeft;
            studyData.dailyHours = dailyHours;
            studyData.totalReqHours = totalReqHours;
            studyData.totalAvailHours = totalAvailHours;
            studyData.checkedDays = {}; // Reset on new plan
            localStorage.removeItem('studysync_checked');

            renderTimetable(schedule);
            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        });

        function animateNumber(el, target) {
            const duration = 600;
            const start = parseInt(el.textContent) || 0;
            const startTime = performance.now();
            function tick(now) {
                const progress = Math.min((now - startTime) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.round(start + (target - start) * eased);
                if (progress < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        }

        function consolidateTasks(tasks) {
            const merged = {};
            tasks.forEach(task => {
                if (!merged[task.title]) merged[task.title] = { ...task };
                else merged[task.title].duration += task.duration;
            });
            return Object.values(merged);
        }

        function renderTimetable(schedule) {
            const timetableContainer = document.getElementById('timetable-container');
            if (schedule.length === 0) {
                timetableContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem;">No schedule generated.</p>';
                return;
            }
            const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            schedule.forEach((day, index) => {
                const dayCard = document.createElement('div');
                dayCard.className = 'day-card';
                dayCard.style.animationDelay = `${index * 0.05}s`;
                dayCard.style.animation = 'slideInUp 0.4s ease forwards';
                dayCard.style.opacity = '0';

                let tasksHtml = day.tasks.map(task => `
                    <div class="task-item">
                        <div class="task-dot" style="background-color: ${task.color}; box-shadow: 0 0 8px ${task.color}50;"></div>
                        <div class="task-details">
                            <span class="task-subject">${task.title}</span>
                            <span class="task-duration"><i class="ri-time-line"></i> ${formatDuration(task.duration)}</span>
                        </div>
                    </div>
                `).join('');

                dayCard.innerHTML = `
                    <div class="day-header">
                        <span class="day-title">Day ${index + 1}</span>
                        <span class="day-date">${formatter.format(day.date)}</span>
                    </div>
                    <div class="task-list">${tasksHtml}</div>
                `;
                timetableContainer.appendChild(dayCard);
            });
        }

        function formatDuration(hours) {
            hours = Math.round(hours * 10) / 10;
            if (hours === 1) return '1 hr';
            if (hours % 1 === 0) return `${hours} hrs`;
            const wholeHours = Math.floor(hours);
            const mins = Math.round((hours - wholeHours) * 60);
            if (wholeHours === 0) return `${mins} mins`;
            return `${wholeHours}h ${mins}m`;
        }
    }

    /* ========================================
       DASHBOARD
       ======================================== */

    function updateDashboard() {
        const schedule = studyData.schedule;
        const subjects = studyData.subjects;
        const checkedDays = studyData.checkedDays;
        const totalDays = schedule.length;
        const completedCount = Object.keys(checkedDays).filter(k => checkedDays[k]).length;

        // --- Stats ---
        const streak = calculateStreak(checkedDays, totalDays);
        const remaining = totalDays - completedCount;
        let hoursStudied = 0;
        Object.keys(checkedDays).forEach(dayIdx => {
            if (checkedDays[dayIdx] && schedule[dayIdx]) {
                schedule[dayIdx].tasks.forEach(t => hoursStudied += t.duration);
            }
        });
        hoursStudied = Math.round(hoursStudied * 10) / 10;

        document.getElementById('dash-streak').textContent = streak;
        document.getElementById('dash-completed').textContent = completedCount;
        document.getElementById('dash-remaining').textContent = remaining;
        document.getElementById('dash-hours-studied').textContent = hoursStudied;

        // --- Progress Ring ---
        const percent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
        document.getElementById('progress-percent').textContent = percent + '%';

        const circumference = 2 * Math.PI * 85; // ~534
        const offset = circumference - (percent / 100) * circumference;
        const ringCircle = document.getElementById('progress-ring-circle');
        ringCircle.style.strokeDashoffset = offset;

        const footerText = document.getElementById('progress-footer-text');
        if (totalDays === 0) {
            footerText.textContent = 'Generate a plan to start tracking';
        } else if (percent === 100) {
            footerText.textContent = '🎉 Amazing! You completed your entire plan!';
        } else if (percent >= 50) {
            footerText.textContent = `You're over halfway there! Keep it up!`;
        } else {
            footerText.textContent = `${completedCount} of ${totalDays} days completed`;
        }

        // --- Subject Progress ---
        const subjectList = document.getElementById('subject-progress-list');
        if (subjects.length === 0 || totalDays === 0) {
            subjectList.innerHTML = '<p class="dash-empty-text">No subjects yet. Generate a study plan first.</p>';
        } else {
            // Calculate per-subject total hours and completed hours
            const subjectTotals = {};
            const subjectCompleted = {};
            subjects.forEach(s => {
                subjectTotals[s.name] = s.totalHours;
                subjectCompleted[s.name] = 0;
            });

            Object.keys(checkedDays).forEach(dayIdx => {
                if (checkedDays[dayIdx] && schedule[dayIdx]) {
                    schedule[dayIdx].tasks.forEach(t => {
                        if (subjectCompleted[t.title] !== undefined) {
                            subjectCompleted[t.title] += t.duration;
                        }
                    });
                }
            });

            subjectList.innerHTML = subjects.map(s => {
                const total = subjectTotals[s.name] || 1;
                const done = Math.min(subjectCompleted[s.name] || 0, total);
                const pct = Math.round((done / total) * 100);
                return `
                    <div class="subject-progress-item">
                        <div class="subject-progress-header">
                            <span class="subject-progress-name">
                                <span class="subject-progress-dot" style="background:${s.color};box-shadow:0 0 6px ${s.color}50;"></span>
                                ${s.name}
                            </span>
                            <span class="subject-progress-pct">${pct}%</span>
                        </div>
                        <div class="subject-progress-bar">
                            <div class="subject-progress-fill" style="width:${pct}%;background:${s.color};"></div>
                        </div>
                    </div>
                `;
            }).join('');

            // Trigger fill animation
            setTimeout(() => {
                subjectList.querySelectorAll('.subject-progress-fill').forEach(bar => {
                    bar.style.width = bar.style.width; // Force reflow
                });
            }, 50);
        }

        // --- Daily Checklist ---
        const checklist = document.getElementById('daily-checklist');
        if (totalDays === 0) {
            checklist.innerHTML = '<p class="dash-empty-text">Generate a study plan to see your daily checklist.</p>';
        } else {
            const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
            checklist.innerHTML = schedule.map((day, i) => {
                const isChecked = checkedDays[i] ? 'checked' : '';
                return `
                    <div class="checklist-day ${isChecked}" data-day="${i}">
                        <div class="checklist-checkbox">
                            <i class="ri-check-line"></i>
                        </div>
                        <div class="checklist-label">
                            <span class="checklist-day-num">Day ${i + 1}</span>
                            <span class="checklist-day-date">${formatter.format(day.date)}</span>
                        </div>
                    </div>
                `;
            }).join('');

            // Click handlers
            checklist.querySelectorAll('.checklist-day').forEach(el => {
                el.addEventListener('click', () => {
                    const dayIdx = el.dataset.day;
                    if (checkedDays[dayIdx]) {
                        delete checkedDays[dayIdx];
                        el.classList.remove('checked');
                    } else {
                        checkedDays[dayIdx] = true;
                        el.classList.add('checked');
                    }
                    localStorage.setItem('studysync_checked', JSON.stringify(checkedDays));
                    // Update stats without full re-render
                    updateDashboardStats();
                });
            });
        }
    }

    function updateDashboardStats() {
        const schedule = studyData.schedule;
        const checkedDays = studyData.checkedDays;
        const totalDays = schedule.length;
        const completedCount = Object.keys(checkedDays).filter(k => checkedDays[k]).length;
        const streak = calculateStreak(checkedDays, totalDays);
        const remaining = totalDays - completedCount;
        let hoursStudied = 0;
        Object.keys(checkedDays).forEach(dayIdx => {
            if (checkedDays[dayIdx] && schedule[dayIdx]) {
                schedule[dayIdx].tasks.forEach(t => hoursStudied += t.duration);
            }
        });
        hoursStudied = Math.round(hoursStudied * 10) / 10;

        document.getElementById('dash-streak').textContent = streak;
        document.getElementById('dash-completed').textContent = completedCount;
        document.getElementById('dash-remaining').textContent = remaining;
        document.getElementById('dash-hours-studied').textContent = hoursStudied;

        const percent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
        document.getElementById('progress-percent').textContent = percent + '%';
        const circumference = 2 * Math.PI * 85;
        const offset = circumference - (percent / 100) * circumference;
        document.getElementById('progress-ring-circle').style.strokeDashoffset = offset;

        const footerText = document.getElementById('progress-footer-text');
        if (percent === 100) footerText.textContent = '🎉 Amazing! You completed your entire plan!';
        else if (percent >= 50) footerText.textContent = `You're over halfway there! Keep it up!`;
        else footerText.textContent = `${completedCount} of ${totalDays} days completed`;

        // Update subject progress bars
        const subjects = studyData.subjects;
        const subjectCompleted = {};
        subjects.forEach(s => subjectCompleted[s.name] = 0);
        Object.keys(checkedDays).forEach(dayIdx => {
            if (checkedDays[dayIdx] && schedule[dayIdx]) {
                schedule[dayIdx].tasks.forEach(t => {
                    if (subjectCompleted[t.title] !== undefined) subjectCompleted[t.title] += t.duration;
                });
            }
        });
        document.querySelectorAll('.subject-progress-item').forEach((item, i) => {
            const s = subjects[i];
            if (!s) return;
            const total = s.totalHours || 1;
            const done = Math.min(subjectCompleted[s.name] || 0, total);
            const pct = Math.round((done / total) * 100);
            item.querySelector('.subject-progress-pct').textContent = pct + '%';
            item.querySelector('.subject-progress-fill').style.width = pct + '%';
        });
    }

    function calculateStreak(checkedDays, totalDays) {
        let streak = 0;
        // Count consecutive checked days from the beginning
        for (let i = 0; i < totalDays; i++) {
            if (checkedDays[i]) streak++;
            else break;
        }
        return streak;
    }
});

