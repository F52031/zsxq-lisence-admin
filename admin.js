// ==================== 配置 ====================
let config = {
    apiUrl: 'https://1340181402-3thvnndcwl.ap-guangzhou.tencentscf.com',
    adminKey: 'ADMIN-KEY-2025'
};

const ADMIN_PASSWORD = 'zsxq2025';

// ==================== 全局状态 ====================
let currentPage = 1;
let currentLogsPage = 1;
let currentIPFilter = '';
const logsPageSize = 30;

// ==================== 初始化 ====================
function checkLogin() {
    return sessionStorage.getItem('adminLoggedIn') === 'true';
}

function doLogin() {
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        document.getElementById('loginOverlay').classList.add('hidden');
        errorEl.textContent = '';
        initApp();
    } else {
        errorEl.textContent = '密码错误';
        document.getElementById('loginPassword').value = '';
    }
}

function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    location.reload();
}

async function initApp() {
    const saved = localStorage.getItem('adminConfig');
    if (saved) {
        const savedConfig = JSON.parse(saved);
        if (savedConfig.apiUrl && savedConfig.apiUrl.includes('tencentscf.com')) {
            config = savedConfig;
        }
    }
    document.getElementById('apiUrl').value = config.apiUrl;
    document.getElementById('adminKey').value = config.adminKey;

    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const validTabs = ['dashboard', 'licenses', 'review', 'logs', 'settings'];
    showTabByName(validTabs.includes(hash) ? hash : 'dashboard');
}

window.onload = () => {
    if (checkLogin()) {
        document.getElementById('loginOverlay').classList.add('hidden');
        initApp();
    }
};

window.onhashchange = () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const validTabs = ['dashboard', 'licenses', 'review', 'logs', 'settings'];
    if (validTabs.includes(hash)) {
        showTabByName(hash);
    }
};

// ==================== 页面切换 ====================
const pageTitles = {
    dashboard: '📊 仪表板',
    licenses: '🔑 密钥管理',
    review: '✅ 激活审核',
    logs: '📋 操作日志',
    settings: '⚙️ 系统设置'
};

function showTabByName(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    document.getElementById('pageTitle').textContent = pageTitles[tabName] || tabName;

    const navItem = document.querySelector(`.nav-item[onclick*="'${tabName}'"]`);
    if (navItem) navItem.classList.add('active');

    window.scrollTo(0, 0);

    if (tabName === 'dashboard') loadDashboard();
    else if (tabName === 'licenses') loadAllLicenses();
    else if (tabName === 'review') { loadPendingIPs(); loadApprovedIPs(); loadRejectedIPs(); }
    else if (tabName === 'logs') loadLogs();
}

function showTab(tabName) {
    window.location.hash = tabName;
    showTabByName(tabName);
}

// ==================== 通用函数 ====================
function showMessage(text, type = 'success') {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = `message ${type} show`;
    setTimeout(() => msg.classList.remove('show'), 2500);
}

async function apiRequest(action, data = {}) {
    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, adminKey: config.adminKey, ...data })
        });
        return await response.json();
    } catch (error) {
        showMessage('网络错误', 'error');
        return { success: false, error: error.message };
    }
}

function formatTime(time) {
    if (typeof time === 'string' && (time.includes('-') || time.includes(':'))) return time;
    try {
        const date = new Date(Number(time));
        if (isNaN(date.getTime())) return time;
        return date.toLocaleString('zh-CN');
    } catch (e) {
        return time;
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showMessage('已复制', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showMessage('已复制', 'success');
    });
}

// ==================== 仪表板 ====================
async function loadDashboard() {
    const result = await apiRequest('list', { page: 1, pageSize: 10 });
    if (result.success) {
        displayStats(result.data);
        displayRecentLicenses(result.data);
    }
}

function displayStats(data) {
    const total = data.total || 0;
    const active = data.licenses.filter(l => !l.isBanned && new Date(l.expire) > new Date()).length;
    const devices = data.licenses.reduce((sum, l) => sum + l.devicesUsed, 0);
    const banned = data.licenses.filter(l => l.isBanned).length;

    document.getElementById('statsContainer').innerHTML = `
        <div class="stat-card"><div class="stat-label">总密钥</div><div class="stat-value">${total}</div></div>
        <div class="stat-card"><div class="stat-label">活跃</div><div class="stat-value">${active}</div></div>
        <div class="stat-card"><div class="stat-label">设备数</div><div class="stat-value">${devices}</div></div>
        <div class="stat-card"><div class="stat-label">封禁</div><div class="stat-value" style="color:#ff4d4f">${banned}</div></div>
    `;
}

function displayRecentLicenses(data) {
    if (!data.licenses || data.licenses.length === 0) {
        document.getElementById('recentLicenses').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无数据</div></div>';
        return;
    }

    let html = '';
    data.licenses.slice(0, 5).forEach(lic => {
        const status = lic.isBanned ? '<span class="badge badge-danger">封禁</span>' :
            new Date(lic.expire) < new Date() ? '<span class="badge badge-warning">过期</span>' :
            '<span class="badge badge-success">正常</span>';

        html += `<div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${lic.license}</div>
                ${status}
            </div>
            <div class="list-item-info">👤 ${lic.customer} · 📱 ${lic.devicesUsed}/${lic.maxDevices}</div>
        </div>`;
    });
    document.getElementById('recentLicenses').innerHTML = html;
}

// ==================== 密钥管理 ====================
function generateLicense() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const parts = [];
    for (let i = 0; i < 4; i++) {
        let part = '';
        for (let j = 0; j < 4; j++) {
            part += chars[Math.floor(Math.random() * chars.length)];
        }
        parts.push(part);
    }
    return 'ZSXQ-' + parts.join('-');
}

function generateNewLicense() {
    document.getElementById('newLicense').value = generateLicense();
}

async function generateTempLicenses() {
    const count = parseInt(document.getElementById('tempLicenseCount').value) || 1;
    if (count < 1 || count > 50) {
        showMessage('数量 1-50', 'error');
        return;
    }

    showMessage('正在生成...', 'success');
    const numberResult = await apiRequest('getNextTempLicenseNumber', { count });
    if (!numberResult.success) {
        showMessage('获取编号失败', 'error');
        return;
    }

    const licenses = numberResult.data.numbers.map(n => `ZSXQ-8888-${n.toString().padStart(4, '0')}`);
    const registerResult = await apiRequest('registerTempLicenses', { licenses });
    if (!registerResult.success) {
        showMessage('注册失败', 'error');
        return;
    }

    let html = `<div class="list-item" style="background:#f6ffed;border-left:3px solid #52c41a;">
        <div class="list-item-info"><strong>✅ 已生成 ${count} 个临时密钥</strong></div>`;
    licenses.forEach(key => {
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e8e8e8;">
            <span class="code">${key}</span>
            <button class="btn-small" onclick="copyToClipboard('${key}')">📋</button>
        </div>`;
    });
    html += `<button class="btn-small btn-success" style="margin-top:10px;width:100%;" onclick="copyToClipboard('${licenses.join('\\n')}')">复制全部</button></div>`;

    document.getElementById('tempLicensesResult').innerHTML = html;
    showMessage(`生成 ${count} 个密钥`, 'success');
}

async function registerLicense() {
    const license = document.getElementById('newLicense').value;
    const customer = document.getElementById('customer').value;
    const expireDate = document.getElementById('expireDate').value;
    const maxDevices = parseInt(document.getElementById('maxDevices').value);

    if (!license || !customer || !expireDate) {
        showMessage('请填写完整', 'error');
        return;
    }

    const result = await apiRequest('register', {
        licenses: [{
            license, customer,
            expire: new Date(expireDate + ' 23:59:59').getTime(),
            maxDevices, created: Date.now()
        }]
    });

    if (result.success) {
        showMessage('注册成功', 'success');
        document.getElementById('newLicense').value = '';
        loadAllLicenses();
    } else {
        showMessage(result.error || '注册失败', 'error');
    }
}

async function loadAllLicenses(page = 1) {
    currentPage = page;
    const result = await apiRequest('list', { page, pageSize: 20 });
    if (result.success) {
        displayAllLicenses(result.data);
        displayLicensesPagination(result.data);
    }
}

function displayAllLicenses(data) {
    if (!data.licenses || data.licenses.length === 0) {
        document.getElementById('allLicenses').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无数据</div></div>';
        return;
    }

    let html = '';
    data.licenses.forEach(lic => {
        const status = lic.isBanned ? '<span class="badge badge-danger">封禁</span>' :
            new Date(lic.expire) < new Date() ? '<span class="badge badge-warning">过期</span>' :
            '<span class="badge badge-success">正常</span>';

        const ipBadge = lic.ipBindingEnabled ? 
            `<span class="badge badge-info">🔒${(lic.allowedIPs||[]).length}IP</span>` : '';

        html += `<div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${lic.license}</div>
                ${status}
            </div>
            <div class="list-item-info">👤 ${lic.customer}</div>
            <div class="list-item-info">📅 ${lic.expire} · 📱 ${lic.devicesUsed}/${lic.maxDevices} ${ipBadge}</div>
            <div class="list-item-actions">
                <button class="btn-small" onclick="editLicense('${lic.license}')">编辑</button>
                ${lic.isBanned ? 
                    `<button class="btn-small btn-success" onclick="unbanLicenseAction('${lic.license}')">解封</button>` :
                    `<button class="btn-small btn-danger" onclick="banLicenseAction('${lic.license}')">封禁</button>`}
                <button class="btn-small btn-danger" onclick="deleteLicense('${lic.license}')">删除</button>
            </div>
        </div>`;
    });
    document.getElementById('allLicenses').innerHTML = html;
}

function displayLicensesPagination(data) {
    if (data.totalPages <= 1) {
        document.getElementById('licensesPagination').innerHTML = '';
        return;
    }
    let html = '<div class="pagination">';
    if (currentPage > 1) html += `<button onclick="loadAllLicenses(${currentPage-1})">上一页</button>`;
    html += `<span>${currentPage}/${data.totalPages}</span>`;
    if (currentPage < data.totalPages) html += `<button onclick="loadAllLicenses(${currentPage+1})">下一页</button>`;
    html += '</div>';
    document.getElementById('licensesPagination').innerHTML = html;
}

async function searchLicenses() {
    const keyword = document.getElementById('searchKeyword').value.trim();
    if (!keyword) { loadAllLicenses(); return; }

    const result = await apiRequest('searchLicense', { keyword });
    if (result.success) {
        displaySearchResults(result.data);
    } else {
        showMessage('搜索失败', 'error');
    }
}

function displaySearchResults(licenses) {
    if (!licenses || licenses.length === 0) {
        document.getElementById('allLicenses').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">未找到</div></div>';
        document.getElementById('licensesPagination').innerHTML = '';
        return;
    }
    // 复用 displayAllLicenses 的格式
    displayAllLicenses({ licenses });
    document.getElementById('licensesPagination').innerHTML = `<div class="pagination"><span>找到 ${licenses.length} 条</span></div>`;
}

async function editLicense(license) {
    const result = await apiRequest('list', { page: 1, pageSize: 1000 });
    if (!result.success) return;
    const lic = result.data.licenses.find(l => l.license === license);
    if (!lic) return;

    const customer = prompt('客户名称:', lic.customer);
    if (!customer) return;
    const expireDate = prompt('过期时间 (YYYY-MM-DD):', lic.expire.split(' ')[0]);
    if (!expireDate) return;
    const maxDevices = prompt('最大设备数:', lic.maxDevices);
    if (!maxDevices) return;

    const updateResult = await apiRequest('updateLicense', {
        license, customer,
        expire: new Date(expireDate + ' 23:59:59').getTime(),
        maxDevices: parseInt(maxDevices)
    });

    if (updateResult.success) {
        showMessage('已更新', 'success');
        loadAllLicenses();
    } else {
        showMessage('更新失败', 'error');
    }
}

async function banLicenseAction(license) {
    if (!confirm(`封禁 ${license}？`)) return;
    const result = await apiRequest('ban', { license });
    if (result.success) { showMessage('已封禁', 'success'); loadAllLicenses(); }
    else showMessage('失败', 'error');
}

async function unbanLicenseAction(license) {
    if (!confirm(`解封 ${license}？`)) return;
    const result = await apiRequest('unbanLicense', { license });
    if (result.success) { showMessage('已解封', 'success'); loadAllLicenses(); }
    else showMessage('失败', 'error');
}

async function deleteLicense(license) {
    if (!confirm(`删除 ${license}？不可恢复！`)) return;
    const result = await apiRequest('deleteLicense', { license });
    if (result.success) { showMessage('已删除', 'success'); loadAllLicenses(); }
    else showMessage('失败', 'error');
}


// ==================== 激活审核 ====================
async function loadPendingIPs() {
    const result = await apiRequest('listPendingIPs', {});
    if (result.success) displayPendingIPs(result.data);
    else document.getElementById('pendingIPsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-text">加载失败</div></div>';
}

function displayPendingIPs(list) {
    if (!list || list.length === 0) {
        document.getElementById('pendingIPsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">暂无待审核</div></div>';
        return;
    }

    let html = '';
    list.forEach(item => {
        const taskCount = item.taskCount || 0;
        const maxTasks = item.maxTasks || 10;
        const deviceShort = item.machineIdFull ? item.machineIdFull.substring(0, 8) + '...' : '-';
        const licenseType = item.licenseType === 'trial' ? '试用' : '临时';

        html += `<div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${item.ip}</div>
                <span class="badge badge-warning">${item.remaining}</span>
            </div>
            <div class="list-item-info">🖥️ ${deviceShort} · 📊 ${taskCount}/${maxTasks}次</div>
            <div class="list-item-info">🕐 ${item.createdAt} · <span class="badge badge-secondary">${licenseType}</span></div>
            <div class="list-item-actions">
                <button class="btn-small btn-success" onclick="approveIPAction('${item.ip}')">✅ 通过</button>
                <button class="btn-small btn-danger" onclick="rejectIPAction('${item.ip}')">❌ 拒绝</button>
            </div>
        </div>`;
    });
    html += `<div class="hint" style="text-align:center;margin-top:8px;">共 ${list.length} 个待审核</div>`;
    document.getElementById('pendingIPsContainer').innerHTML = html;
}

async function approveIPAction(ip) {
    if (!confirm(`通过 ${ip}？\n通过后可永久使用`)) return;
    const result = await apiRequest('approveIP', { ip });
    if (result.success) { showMessage('已通过', 'success'); loadPendingIPs(); loadApprovedIPs(); }
    else showMessage('失败', 'error');
}

async function rejectIPAction(ip) {
    if (!confirm(`拒绝 ${ip}？`)) return;
    const result = await apiRequest('rejectIP', { ip });
    if (result.success) { showMessage('已拒绝', 'success'); loadPendingIPs(); loadRejectedIPs(); }
    else showMessage('失败', 'error');
}

async function loadApprovedIPs() {
    const result = await apiRequest('listApprovedIPs', {});
    if (result.success) displayApprovedIPs(result.data);
    else document.getElementById('approvedIPsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-text">加载失败</div></div>';
}

function displayApprovedIPs(list) {
    if (!list || list.length === 0) {
        document.getElementById('approvedIPsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无</div></div>';
        return;
    }

    let html = '';
    list.forEach(item => {
        const ip = typeof item === 'string' ? item : (item.ip || '');
        const machineId = typeof item === 'object' ? (item.machineId || '') : '';
        const lastSeen = typeof item === 'object' ? (item.lastSeen || '-') : '-';
        const deviceShort = machineId ? machineId.substring(0, 8) + '...' : '-';

        html += `<div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${ip}</div>
                <span class="badge badge-success">已授权</span>
            </div>
            <div class="list-item-info">🖥️ ${deviceShort} · 🕐 ${lastSeen}</div>
            <div class="list-item-actions">
                <button class="btn-small btn-danger" onclick="removeApprovedIPAction('${ip}')">移除</button>
            </div>
        </div>`;
    });
    html += `<div class="hint" style="text-align:center;margin-top:8px;">共 ${list.length} 个已授权</div>`;
    document.getElementById('approvedIPsContainer').innerHTML = html;
}

async function removeApprovedIPAction(ip) {
    if (!confirm(`移除 ${ip}？\n移除后无法使用`)) return;
    const result = await apiRequest('removeApprovedIP', { ip });
    if (result.success) { showMessage('已移除', 'success'); loadApprovedIPs(); }
    else showMessage('失败', 'error');
}

async function loadRejectedIPs() {
    const result = await apiRequest('listRejectedIPs', {});
    if (result.success) displayRejectedIPs(result.data);
    else document.getElementById('rejectedIPsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-text">加载失败</div></div>';
}

function displayRejectedIPs(list) {
    if (!list || list.length === 0) {
        document.getElementById('rejectedIPsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">暂无</div></div>';
        return;
    }

    let html = '';
    list.forEach(ip => {
        html += `<div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${ip}</div>
                <span class="badge badge-danger">已拒绝</span>
            </div>
            <div class="list-item-actions">
                <button class="btn-small btn-success" onclick="unrejectIPAction('${ip}')">恢复</button>
            </div>
        </div>`;
    });
    html += `<div class="hint" style="text-align:center;margin-top:8px;">共 ${list.length} 个</div>`;
    document.getElementById('rejectedIPsContainer').innerHTML = html;
}

async function unrejectIPAction(ip) {
    if (!confirm(`恢复 ${ip}？`)) return;
    const result = await apiRequest('unrejectIP', { ip });
    if (result.success) { showMessage('已恢复', 'success'); loadRejectedIPs(); }
    else showMessage('失败', 'error');
}

async function manualBanIP() {
    const input = document.getElementById('banIPInput');
    const ip = input.value.trim();
    if (!ip) { showMessage('请输入 IP', 'error'); return; }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { showMessage('IP 格式错误', 'error'); return; }
    if (!confirm(`封禁 ${ip}？`)) return;

    const result = await apiRequest('rejectIP', { ip });
    if (result.success) { showMessage('已封禁', 'success'); input.value = ''; loadRejectedIPs(); }
    else showMessage('失败', 'error');
}

// ==================== 操作日志 ====================
async function loadLogs(page = 1) {
    currentLogsPage = page;
    const params = { page, pageSize: logsPageSize };
    if (currentIPFilter) params.ip = currentIPFilter;

    const result = await apiRequest('getLogs', params);
    if (result.success) {
        displayLogs(result.data, result.total || 0);
        if (currentIPFilter) {
            document.getElementById('logSearchInfo').style.display = 'block';
            document.getElementById('logSearchInfo').textContent = `🔍 IP: ${currentIPFilter} (${result.total || 0} 条)`;
        } else {
            document.getElementById('logSearchInfo').style.display = 'none';
        }
    }
}

function displayLogs(logs, total) {
    if (!logs || logs.length === 0) {
        document.getElementById('logsContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无日志</div></div>';
        document.getElementById('logsPagination').innerHTML = '';
        return;
    }

    const actionMap = {
        'validate': '🔐 验证',
        'task_start': '▶️ 任务',
        'temp_first_task': '✨ 首次激活',
        'auto_ip_binding': '🔒 IP绑定',
        'approve': '✅ 通过',
        'reject': '❌ 拒绝'
    };

    let html = '';
    logs.forEach(log => {
        const action = actionMap[log.action] || log.action;
        const feature = log.feature && log.feature !== '-' ? `<span class="badge badge-info">${log.feature}</span>` : '';
        const machineShort = log.machineId ? log.machineId.substring(0, 8) + '...' : '-';

        html += `<div class="log-item">
            <div class="log-item-header">
                <span class="log-item-action">${action} ${feature}</span>
                <span class="log-item-time">${log.timestamp}</span>
            </div>
            <div class="log-item-details">
                <span>🌐 ${log.ip || '-'}</span>
                <span>🖥️ ${machineShort}</span>
                ${log.customer && log.customer !== '-' ? `<span>👤 ${log.customer}</span>` : ''}
            </div>
        </div>`;
    });
    document.getElementById('logsContainer').innerHTML = html;

    // 分页
    const totalPages = Math.ceil(total / logsPageSize);
    if (totalPages <= 1) {
        document.getElementById('logsPagination').innerHTML = '';
        return;
    }
    let phtml = '<div class="pagination">';
    if (currentLogsPage > 1) phtml += `<button onclick="loadLogs(${currentLogsPage-1})">上一页</button>`;
    phtml += `<span>${currentLogsPage}/${totalPages}</span>`;
    if (currentLogsPage < totalPages) phtml += `<button onclick="loadLogs(${currentLogsPage+1})">下一页</button>`;
    phtml += '</div>';
    document.getElementById('logsPagination').innerHTML = phtml;
}

function searchLogsByIP() {
    const ip = document.getElementById('logSearchIP').value.trim();
    if (!ip) { showMessage('请输入 IP', 'error'); return; }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { showMessage('IP 格式错误', 'error'); return; }
    currentIPFilter = ip;
    currentLogsPage = 1;
    loadLogs(1);
}

function clearLogSearch() {
    currentIPFilter = '';
    document.getElementById('logSearchIP').value = '';
    document.getElementById('logSearchInfo').style.display = 'none';
    currentLogsPage = 1;
    loadLogs(1);
}

// ==================== 设置 ====================
function saveConfig() {
    config.apiUrl = document.getElementById('apiUrl').value.trim();
    config.adminKey = document.getElementById('adminKey').value.trim();
    localStorage.setItem('adminConfig', JSON.stringify(config));
    showMessage('已保存', 'success');
}

async function testConnection() {
    showMessage('测试中...', 'success');
    const result = await apiRequest('list', { page: 1, pageSize: 1 });
    if (result.success) showMessage('连接成功', 'success');
    else showMessage('连接失败', 'error');
}

async function exportAllData() {
    const result = await apiRequest('exportData', {});
    if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showMessage('已导出', 'success');
    } else {
        showMessage('导出失败', 'error');
    }
}
