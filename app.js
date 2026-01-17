// Глобальные переменные
let mainChart = null;
let currentChartType = 'yield';
let calculationResults = null;
let comparisonData = [];

// Пресеты облигаций
const bondPresets = {
    '26238': {
        name: 'ОФЗ 26238',
        nominal: 1000,
        price: 556.5,
        coupon: 35.4,
        periodDays: 182,
        maturity: '2041-05-15',
        purchase: '2025-06-22',
        firstCoupon: '2025-12-03',
        priceTable: {
            20: 556.5,
            17: 600,
            15: 645,
            13: 700,
            11: 760,
            10: 820,
            9: 890,
            8: 960,
            7.5: 1000,
            7: 1000
        },
        ytmTable: {
            20: 14.79,
            17: 13.79,
            15: 12.79,
            13: 11.79,
            11: 10.79,
            10: 9.79,
            9: 8.79,
            8: 7.79,
            7.5: 7.10,
            7: 7.10
        }
    },
    '26248': {
        name: 'ОФЗ 26248',
        nominal: 1000,
        price: 860.6,
        coupon: 61.08,
        periodDays: 182,
        maturity: '2040-05-16',
        purchase: '2025-06-22',
        firstCoupon: '2025-12-03',
        priceTable: {
            20: 860.6,
            17: 910,
            15: 970,
            14.21: 1030,
            13: 1100,
            11: 1180,
            10: 1237.5,
            9: 1330,
            8: 1400,
            7.5: 1400,
            7: 1450
        },
        ytmTable: {
            20: 15.21,
            17: 14.21,
            15: 13.21,
            13: 12.21,
            11: 11.21,
            10: 10.21,
            9: 9.21,
            8: 8.21,
            7.5: 7.30,
            7: 6.70
        }
    },
    '26247': {
        name: 'ОФЗ 26247',
        nominal: 1000,
        price: 870,
        coupon: 60.64,
        periodDays: 182,
        maturity: '2039-05-21',
        purchase: '2025-06-22',
        firstCoupon: '2025-12-03',
        priceTable: {
            20: 870,
            17: 920,
            15: 980,
            13: 1050,
            11: 1140,
            10: 1200,
            9: 1280,
            8: 1360,
            7.5: 1400,
            7: 1450
        },
        ytmTable: {
            20: 15.0,
            17: 14.0,
            15: 13.0,
            13: 12.0,
            11: 11.0,
            10: 10.0,
            9: 9.0,
            8: 8.0,
            7.5: 7.2,
            7: 6.7
        }
    },
    '26244': {
        name: 'ОФЗ 26244',
        nominal: 1000,
        price: 750,
        coupon: 52.41,
        periodDays: 182,
        maturity: '2034-03-15',
        purchase: '2025-06-22',
        firstCoupon: '2025-12-03',
        priceTable: {
            20: 750,
            17: 800,
            15: 860,
            13: 920,
            11: 970,
            10: 1000,
            9: 1000,
            8: 1000,
            7.5: 1000,
            7: 1000
        },
        ytmTable: {
            20: 15.5,
            17: 14.2,
            15: 13.0,
            13: 11.8,
            11: 10.6,
            10: 10.0,
            9: 9.5,
            8: 9.0,
            7.5: 8.5,
            7: 8.0
        }
    }
};

// Сценарии изменения ставки
const rateScenarios = {
    base: [
        { date: '2025-06-22', rate: 20 },
        { date: '2025-12-03', rate: 17 },
        { date: '2026-06-03', rate: 15 },
        { date: '2026-12-02', rate: 13 },
        { date: '2027-06-02', rate: 11 },
        { date: '2027-12-01', rate: 10 },
        { date: '2028-05-31', rate: 9 },
        { date: '2028-11-29', rate: 8 },
        { date: '2029-05-30', rate: 7.5 }
    ],
    conservative: [
        { date: '2025-06-22', rate: 20 },
        { date: '2025-12-01', rate: 19 },
        { date: '2026-06-01', rate: 17 },
        { date: '2026-12-01', rate: 15 },
        { date: '2027-06-01', rate: 13 },
        { date: '2027-12-01', rate: 11 },
        { date: '2028-06-01', rate: 10 },
        { date: '2028-12-01', rate: 9 },
        { date: '2029-06-01', rate: 8 },
        { date: '2030-01-01', rate: 7.5 }
    ],
    moderate: [
        { date: '2025-06-22', rate: 20 },
        { date: '2025-12-01', rate: 17 },
        { date: '2026-06-01', rate: 14 },
        { date: '2026-12-01', rate: 11 },
        { date: '2027-06-01', rate: 9 },
        { date: '2027-12-01', rate: 7.5 }
    ],
    constant: [
        { date: '2025-06-22', rate: 20 }
    ]
};

let currentBondId = '26238';

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadPreset('26238');
    loadScenario('base');
});

// Загрузка пресета облигации
function loadPreset(presetId) {
    const preset = bondPresets[presetId];
    if (!preset) return;

    currentBondId = presetId;

    document.querySelectorAll('.bond-presets .preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('preset-' + presetId)?.classList.add('active');

    document.getElementById('bondName').value = preset.name;
    document.getElementById('nominal').value = preset.nominal;
    document.getElementById('currentPrice').value = preset.price;
    document.getElementById('coupon').value = preset.coupon;
    document.getElementById('couponPeriodDays').value = preset.periodDays;
    document.getElementById('maturityDate').value = preset.maturity;
    document.getElementById('purchaseDate').value = preset.purchase;
    document.getElementById('firstCouponDate').value = preset.firstCoupon || preset.purchase;
}

// Загрузка сценария ставки
function loadScenario(scenarioId) {
    const scenario = rateScenarios[scenarioId];
    if (!scenario) return;

    document.querySelectorAll('.scenario-presets .preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('scenario-' + scenarioId)?.classList.add('active');

    const container = document.getElementById('rateSchedule');
    container.innerHTML = '';

    scenario.forEach((item, index) => {
        addRatePeriodWithData(item.date, item.rate);
    });
}

// Добавить период ставки
function addRatePeriod() {
    addRatePeriodWithData('', 10);
}

function addRatePeriodWithData(date, rate) {
    const container = document.getElementById('rateSchedule');
    const div = document.createElement('div');
    div.className = 'form-row';
    div.style.marginBottom = '8px';
    div.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <input type="date" class="rate-date" value="${date}">
        </div>
        <div class="form-group" style="margin-bottom: 0; display: flex; gap: 5px;">
            <input type="number" class="rate-value" value="${rate}" step="0.5" style="flex: 1;">
            <span style="padding: 8px;">%</span>
            <button onclick="this.parentElement.parentElement.remove()" style="padding: 5px 10px; cursor: pointer;">×</button>
        </div>
    `;
    container.appendChild(div);
}

// Получить расписание ставок
function getRateSchedule() {
    const dates = document.querySelectorAll('.rate-date');
    const values = document.querySelectorAll('.rate-value');
    const schedule = [];

    dates.forEach((dateInput, i) => {
        if (dateInput.value) {
            schedule.push({
                date: new Date(dateInput.value),
                rate: parseFloat(values[i].value)
            });
        }
    });

    schedule.sort((a, b) => a.date - b.date);
    return schedule;
}

// Получить ставку на дату
function getKeyRateAtDate(date, schedule) {
    let rate = 20;

    for (const item of schedule) {
        if (date >= item.date) {
            rate = item.rate;
        } else {
            break;
        }
    }

    return rate;
}

// Интерполяция из таблицы
function interpolateFromTable(table, keyRate) {
    const keys = Object.keys(table).map(Number).sort((a, b) => b - a);

    if (keyRate >= keys[0]) return table[keys[0]];
    if (keyRate <= keys[keys.length - 1]) return table[keys[keys.length - 1]];

    for (let i = 0; i < keys.length - 1; i++) {
        if (keyRate <= keys[i] && keyRate >= keys[i + 1]) {
            const high = keys[i];
            const low = keys[i + 1];
            const ratio = (keyRate - low) / (high - low);
            return table[low] + ratio * (table[high] - table[low]);
        }
    }

    return table[keys[0]];
}

// Получить YTM по ключевой ставке
function getYTMFromKeyRate(keyRate, bondId) {
    const preset = bondPresets[bondId];
    if (preset && preset.ytmTable) {
        return interpolateFromTable(preset.ytmTable, keyRate);
    }
    return keyRate - 5.21;
}

// Расчёт цены облигации через дисконтирование денежных потоков
function calculateBondPrice(coupon, nominal, ytmAnnual, periodsRemaining, periodsPerYear = 2) {
    if (periodsRemaining <= 0) return nominal;

    const ytmPerPeriod = ytmAnnual / 100 / periodsPerYear;
    let price = 0;

    for (let t = 1; t <= periodsRemaining; t++) {
        price += coupon / Math.pow(1 + ytmPerPeriod, t);
    }

    price += nominal / Math.pow(1 + ytmPerPeriod, periodsRemaining);

    return price;
}

// Получить цену по ключевой ставке с учётом срока до погашения
function getPriceFromKeyRate(keyRate, bondId, yearsToMaturity = null, coupon = null, nominal = null) {
    const preset = bondPresets[bondId];
    if (!preset) return 1000;

    const ytm = getYTMFromKeyRate(keyRate, bondId);

    if (yearsToMaturity === null) {
        if (preset.priceTable) {
            return interpolateFromTable(preset.priceTable, keyRate);
        }
        return 1000;
    }

    const bondCoupon = coupon || preset.coupon;
    const bondNominal = nominal || preset.nominal;
    const periodsPerYear = 2;

    const periodsRemaining = Math.round(yearsToMaturity * periodsPerYear);

    if (periodsRemaining <= 0) return bondNominal;

    return calculateBondPrice(bondCoupon, bondNominal, ytm, periodsRemaining, periodsPerYear);
}

// Расчёт XIRR (внутренней нормы доходности)
function xirr(cashflows, dates, guess = 0.1) {
    const maxIterations = 100;
    const tolerance = 1e-7;

    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
        let npv = 0;
        let dnpv = 0;

        const firstDate = dates[0];

        for (let j = 0; j < cashflows.length; j++) {
            const years = (dates[j] - firstDate) / (365 * 24 * 60 * 60 * 1000);
            const factor = Math.pow(1 + rate, years);
            npv += cashflows[j] / factor;
            dnpv -= years * cashflows[j] / (factor * (1 + rate));
        }

        if (Math.abs(npv) < tolerance) {
            return rate;
        }

        if (Math.abs(dnpv) < tolerance) {
            break;
        }

        const newRate = rate - npv / dnpv;

        if (Math.abs(newRate - rate) < tolerance) {
            return newRate;
        }

        rate = newRate;

        if (rate < -0.99) rate = -0.5;
        if (rate > 10) rate = 1;
    }

    return rate;
}

// Основной расчёт
function calculate() {
    const bondName = document.getElementById('bondName').value;
    const nominal = parseFloat(document.getElementById('nominal').value);
    const investment = parseFloat(document.getElementById('currentPrice').value);
    const coupon = parseFloat(document.getElementById('coupon').value);
    const periodDays = parseInt(document.getElementById('couponPeriodDays').value);
    const purchaseDate = new Date(document.getElementById('purchaseDate').value);
    const firstCouponDate = new Date(document.getElementById('firstCouponDate').value);
    const maturityDate = new Date(document.getElementById('maturityDate').value);

    const rateSchedule = getRateSchedule();

    const yearsToMaturity = (maturityDate - purchaseDate) / (365 * 24 * 60 * 60 * 1000);
    const periodYears = periodDays / 365;

    // Генерация дат купонов
    const couponDates = [];
    let currentDate = new Date(firstCouponDate);

    while (currentDate < maturityDate) {
        couponDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + periodDays);
    }

    couponDates.push(new Date(maturityDate));

    const couponCount = couponDates.length;

    // 1. Расчёт YTM через XIRR
    const cashflowsYTM = [-investment];
    const datesYTM = [purchaseDate];

    for (let i = 0; i < couponDates.length; i++) {
        const isLast = i === couponDates.length - 1;
        cashflowsYTM.push(isLast ? coupon + nominal : coupon);
        datesYTM.push(couponDates[i]);
    }

    const ytm = xirr(cashflowsYTM, datesYTM) * 100;

    // 2. Сумма при реинвестировании под YTM
    let totalWithYTM = 0;
    for (let i = 0; i < couponDates.length; i++) {
        const yearsRemaining = (maturityDate - couponDates[i]) / (365 * 24 * 60 * 60 * 1000);
        const isLast = i === couponDates.length - 1;
        const cf = isLast ? coupon + nominal : coupon;
        totalWithYTM += cf * Math.pow(1 + ytm / 100, yearsRemaining);
    }

    // 3. Без реинвестирования
    let totalNoReinvest = coupon * couponCount + nominal;
    const yieldNoReinvest = xirr([-investment, totalNoReinvest], [purchaseDate, maturityDate]) * 100;

    // 4. С изменяющейся ставкой реинвестирования
    let totalWithVariableRate = 0;
    for (let i = 0; i < couponDates.length; i++) {
        const couponDate = couponDates[i];
        const yearsRemaining = (maturityDate - couponDate) / (365 * 24 * 60 * 60 * 1000);
        const keyRate = getKeyRateAtDate(couponDate, rateSchedule);
        const reinvestRate = getYTMFromKeyRate(keyRate, currentBondId) / 100;

        const isLast = i === couponDates.length - 1;
        const cf = isLast ? coupon + nominal : coupon;

        totalWithVariableRate += cf * Math.pow(1 + reinvestRate, yearsRemaining);
    }

    // 5. Полный расчёт с покупонным реинвестированием
    let totalFullModel = 0;

    for (let i = 0; i < couponDates.length; i++) {
        const couponDate = couponDates[i];
        const isLast = i === couponDates.length - 1;
        let couponValue = isLast ? coupon + nominal : coupon;

        for (let j = i; j < couponDates.length - 1; j++) {
            const periodStart = couponDates[j];
            const periodEnd = couponDates[j + 1];
            const periodLength = (periodEnd - periodStart) / (365 * 24 * 60 * 60 * 1000);

            const keyRate = getKeyRateAtDate(periodStart, rateSchedule);
            const reinvestRate = getYTMFromKeyRate(keyRate, currentBondId) / 100;

            couponValue *= Math.pow(1 + reinvestRate, periodLength);
        }

        totalFullModel += couponValue;
    }

    const realYieldMaturity = xirr([-investment, totalFullModel], [purchaseDate, maturityDate]) * 100;

    // 6. Расчёт таблицы выходов
    const exitResults = [];

    for (let i = 0; i < couponDates.length; i++) {
        const exitDate = couponDates[i];
        const years = (exitDate - purchaseDate) / (365 * 24 * 60 * 60 * 1000);
        const keyRate = getKeyRateAtDate(exitDate, rateSchedule);
        const reinvestRate = getYTMFromKeyRate(keyRate, currentBondId);
        const isLast = i === couponDates.length - 1;

        const yearsRemaining = (maturityDate - exitDate) / (365 * 24 * 60 * 60 * 1000);
        const bondPrice = isLast ? nominal : getPriceFromKeyRate(keyRate, currentBondId, yearsRemaining, coupon, nominal);

        let reinvestedCoupons = 0;
        for (let j = 0; j < i; j++) {
            let couponValue = coupon;
            for (let k = j; k < i; k++) {
                const periodStart = couponDates[k];
                const periodEnd = couponDates[k + 1];
                const periodLength = (periodEnd - periodStart) / (365 * 24 * 60 * 60 * 1000);
                const kr = getKeyRateAtDate(periodStart, rateSchedule);
                const rr = getYTMFromKeyRate(kr, currentBondId) / 100;
                couponValue *= Math.pow(1 + rr, periodLength);
            }
            reinvestedCoupons += couponValue;
        }

        reinvestedCoupons += coupon;

        const exitValue = isLast ? (reinvestedCoupons + nominal) : (bondPrice + reinvestedCoupons);

        const totalReturn = (exitValue - investment) / investment * 100;
        const annualReturn = years > 0 ? (Math.pow(exitValue / investment, 1 / years) - 1) * 100 : 0;

        exitResults.push({
            date: exitDate,
            years: years,
            keyRate: keyRate,
            reinvestRate: reinvestRate,
            bondPrice: bondPrice,
            reinvestedCoupons: reinvestedCoupons,
            exitValue: exitValue,
            totalReturn: totalReturn,
            annualReturn: annualReturn,
            isLast: isLast
        });
    }

    // Найти оптимальную точку выхода
    let optimalExit = exitResults[0];
    for (const exit of exitResults) {
        if (exit.annualReturn > optimalExit.annualReturn) {
            optimalExit = exit;
        }
    }

    // Найти момент достижения номинала
    let parExit = null;
    for (const exit of exitResults) {
        if (exit.bondPrice >= nominal * 0.995) {
            parExit = exit;
            break;
        }
    }
    if (!parExit) {
        parExit = exitResults[exitResults.length - 1];
    }

    // Сохранение результатов
    calculationResults = {
        bondName,
        investment,
        nominal,
        coupon,
        ytm,
        yearsToMaturity,
        couponCount,
        totalWithYTM,
        yieldNoReinvest,
        totalNoReinvest,
        totalWithVariableRate,
        realYieldMaturity,
        totalFullModel,
        exitResults,
        optimalExit,
        parExit
    };

    displayResults();
    validateResults();
    updateChart();
    updateExitTable();
}

// Отображение результатов
function displayResults() {
    const r = calculationResults;

    document.getElementById('investmentAmount').textContent = r.investment.toFixed(2) + ' ₽';
    document.getElementById('ytmResult').textContent = r.ytm.toFixed(2) + '%';
    document.getElementById('yearsToMaturity').textContent = r.yearsToMaturity.toFixed(3);
    document.getElementById('couponCount').textContent = r.couponCount;
    document.getElementById('totalWithYTM').textContent = r.totalWithYTM.toFixed(2) + ' ₽';

    document.getElementById('yieldNoReinvest').textContent = r.yieldNoReinvest.toFixed(2) + '%';
    document.getElementById('totalNoReinvest').textContent = r.totalNoReinvest.toFixed(2) + ' ₽';

    document.getElementById('realYieldMaturity').textContent = r.realYieldMaturity.toFixed(2) + '%';
    document.getElementById('totalAtMaturity').textContent = r.totalFullModel.toFixed(2) + ' ₽';

    document.getElementById('optimalYield').textContent = r.optimalExit.annualReturn.toFixed(1) + '%';
    document.getElementById('optimalExitDate').textContent =
        'При выходе: ' + r.optimalExit.date.toLocaleDateString('ru-RU') +
        ' (' + r.optimalExit.years.toFixed(1) + ' лет)';

    document.getElementById('parExitYield').textContent = r.parExit.annualReturn.toFixed(1) + '%';
    const parReachedNominal = r.parExit.bondPrice >= r.nominal * 0.995;
    document.getElementById('parExitDate').textContent =
        (parReachedNominal ? 'Цена ' + r.parExit.bondPrice.toFixed(0) + '₽: ' : 'Погашение: ') +
        r.parExit.date.toLocaleDateString('ru-RU') +
        ' (' + r.parExit.years.toFixed(1) + ' лет)';
}

// Проверка результатов
function validateResults() {
    const r = calculationResults;
    const container = document.getElementById('validationResults');

    const checkpoints = {
        '26238': {
            ytm: 14.79,
            yieldNoReinvest: 8.81,
            totalNoReinvest: 2132.80,
            totalWithYTM: 4995.44,
            realYield: 11.30,
            totalReal: 3056.48
        },
        '26248': {
            realYield: 11.06
        }
    };

    const cp = checkpoints[currentBondId];
    if (!cp) {
        container.innerHTML = '<p class="info-text">Контрольные точки для этой облигации не заданы</p>';
        return;
    }

    let html = '<div class="validation-box success">';
    html += '<h3>Сравнение с контрольными значениями (ОФЗ ' + currentBondId + ')</h3>';

    const checks = [];

    if (cp.ytm) {
        const diff = Math.abs(r.ytm - cp.ytm);
        checks.push({
            label: 'YTM',
            calculated: r.ytm.toFixed(2) + '%',
            expected: cp.ytm.toFixed(2) + '%',
            ok: diff < 0.1
        });
    }

    if (cp.yieldNoReinvest) {
        const diff = Math.abs(r.yieldNoReinvest - cp.yieldNoReinvest);
        checks.push({
            label: 'Доходность без реинвест.',
            calculated: r.yieldNoReinvest.toFixed(2) + '%',
            expected: cp.yieldNoReinvest.toFixed(2) + '%',
            ok: diff < 0.1
        });
    }

    if (cp.totalNoReinvest) {
        const diff = Math.abs(r.totalNoReinvest - cp.totalNoReinvest);
        checks.push({
            label: 'Сумма без реинвест.',
            calculated: r.totalNoReinvest.toFixed(2) + ' ₽',
            expected: cp.totalNoReinvest.toFixed(2) + ' ₽',
            ok: diff < 10
        });
    }

    if (cp.totalWithYTM) {
        const diff = Math.abs(r.totalWithYTM - cp.totalWithYTM);
        checks.push({
            label: 'Сумма при реинвест. под YTM',
            calculated: r.totalWithYTM.toFixed(2) + ' ₽',
            expected: cp.totalWithYTM.toFixed(2) + ' ₽',
            ok: diff < 10
        });
    }

    if (cp.realYield) {
        const diff = Math.abs(r.realYieldMaturity - cp.realYield);
        checks.push({
            label: 'Реальная доходность',
            calculated: r.realYieldMaturity.toFixed(2) + '%',
            expected: cp.realYield.toFixed(2) + '%',
            ok: diff < 0.3
        });
    }

    if (cp.totalReal) {
        const diff = Math.abs(r.totalFullModel - cp.totalReal);
        checks.push({
            label: 'Сумма к погашению (реальная)',
            calculated: r.totalFullModel.toFixed(2) + ' ₽',
            expected: cp.totalReal.toFixed(2) + ' ₽',
            ok: diff < 50
        });
    }

    for (const check of checks) {
        const icon = check.ok ? '✓' : '✗';
        const color = check.ok ? '#16a34a' : '#dc2626';
        html += `<div class="validation-row">
            <span>${check.label}</span>
            <span><span style="color:${color}">${icon}</span> ${check.calculated} (ожид: ${check.expected})</span>
        </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

// Обновление графика
function updateChart() {
    const r = calculationResults;
    if (!r) return;

    const ctx = document.getElementById('mainChart').getContext('2d');

    if (mainChart) {
        mainChart.destroy();
    }

    const labels = r.exitResults.map(e =>
        e.date.toLocaleDateString('ru-RU', { year: '2-digit', month: 'short' })
    );

    let data, label, color;

    switch (currentChartType) {
        case 'yield':
            data = r.exitResults.map(e => e.annualReturn);
            label = 'Годовая доходность, %';
            color = '#2563eb';
            break;
        case 'price':
            data = r.exitResults.map(e => e.bondPrice);
            label = 'Цена облигации, ₽';
            color = '#16a34a';
            break;
        case 'total':
            data = r.exitResults.map(e => e.exitValue);
            label = 'Сумма дохода, ₽';
            color = '#ca8a04';
            break;
    }

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color,
                backgroundColor: color + '20',
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// Переключение графика
function switchChart(type) {
    currentChartType = type;

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    updateChart();
}

// Обновление таблицы выходов
function updateExitTable() {
    const r = calculationResults;
    if (!r) return;

    const tbody = document.querySelector('#exitTable tbody');
    tbody.innerHTML = '';

    const maxAnnualReturn = Math.max(...r.exitResults.map(e => e.annualReturn));

    r.exitResults.forEach(exit => {
        const tr = document.createElement('tr');
        const isBest = Math.abs(exit.annualReturn - maxAnnualReturn) < 0.01;
        const isParExit = r.parExit && exit.date.getTime() === r.parExit.date.getTime();

        if (isParExit) {
            tr.style.background = 'rgba(45, 138, 62, 0.3)';
        }

        tr.innerHTML = `
            <td>${exit.date.toLocaleDateString('ru-RU')}</td>
            <td>${exit.years.toFixed(3)}</td>
            <td>${exit.keyRate.toFixed(1)}%</td>
            <td>${exit.reinvestRate.toFixed(2)}%</td>
            <td>${exit.bondPrice.toFixed(1)} ₽${isParExit ? ' 🎯' : ''}</td>
            <td>${exit.reinvestedCoupons.toFixed(1)} ₽</td>
            <td>${exit.exitValue.toFixed(1)} ₽</td>
            <td>${exit.totalReturn.toFixed(1)}%</td>
            <td class="${isBest ? 'best-value' : ''}">${exit.annualReturn.toFixed(1)}%</td>
        `;

        tbody.appendChild(tr);
    });
}

// Добавить к сравнению
function addToComparison() {
    if (!calculationResults) {
        calculate();
    }

    const exists = comparisonData.find(d => d.bondName === calculationResults.bondName);
    if (exists) {
        alert('Эта облигация уже добавлена к сравнению');
        return;
    }

    comparisonData.push({...calculationResults});
    updateComparisonTable();
}

// Очистить сравнение
function clearComparison() {
    comparisonData = [];
    updateComparisonTable();
}

// Обновить таблицу сравнения
function updateComparisonTable() {
    const container = document.getElementById('comparisonResults');

    if (comparisonData.length === 0) {
        container.innerHTML = '<p class="info-text">Выберите облигацию, нажмите "Рассчитать", затем "Добавить к сравнению"</p>';
        return;
    }

    const bestYTM = Math.max(...comparisonData.map(d => d.ytm));
    const bestReal = Math.max(...comparisonData.map(d => d.realYieldMaturity));
    const bestOptimal = Math.max(...comparisonData.map(d => d.optimalExit.annualReturn));

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Показатель</th>
                    ${comparisonData.map(d => `<th>${d.bondName}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Инвестиция</td>
                    ${comparisonData.map(d => `<td>${d.investment.toFixed(2)} ₽</td>`).join('')}
                </tr>
                <tr>
                    <td>YTM (стандартный)</td>
                    ${comparisonData.map(d => `<td class="${Math.abs(d.ytm - bestYTM) < 0.01 ? 'best-value' : ''}">${d.ytm.toFixed(2)}%</td>`).join('')}
                </tr>
                <tr>
                    <td>Без реинвестирования</td>
                    ${comparisonData.map(d => `<td>${d.yieldNoReinvest.toFixed(2)}%</td>`).join('')}
                </tr>
                <tr>
                    <td>Реальная дох. (до погашения)</td>
                    ${comparisonData.map(d => `<td class="${Math.abs(d.realYieldMaturity - bestReal) < 0.01 ? 'best-value' : ''}">${d.realYieldMaturity.toFixed(2)}%</td>`).join('')}
                </tr>
                <tr>
                    <td>Оптимальная годовая дох.</td>
                    ${comparisonData.map(d => `<td class="${Math.abs(d.optimalExit.annualReturn - bestOptimal) < 0.1 ? 'best-value' : ''}">${d.optimalExit.annualReturn.toFixed(1)}%</td>`).join('')}
                </tr>
                <tr>
                    <td>Макс. дох. - срок выхода</td>
                    ${comparisonData.map(d => `<td>${d.optimalExit.years.toFixed(1)} лет</td>`).join('')}
                </tr>
                <tr>
                    <td>Дох. при цене ≈ номинала</td>
                    ${comparisonData.map(d => `<td>${d.parExit.annualReturn.toFixed(1)}%</td>`).join('')}
                </tr>
                <tr>
                    <td>Срок до цены ≈ номинала</td>
                    ${comparisonData.map(d => `<td>${d.parExit.years.toFixed(1)} лет</td>`).join('')}
                </tr>
                <tr>
                    <td>Срок до погашения</td>
                    ${comparisonData.map(d => `<td>${d.yearsToMaturity.toFixed(1)} лет</td>`).join('')}
                </tr>
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}
