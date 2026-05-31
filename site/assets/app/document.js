const docSelectors = {
    series: document.getElementById('docSeries'),
    status: document.getElementById('docStatus'),
    issuer: document.getElementById('docIssuer'),
    expiry: document.getElementById('docExpiry'),
    issueDate: document.getElementById('docIssueDate'),
    update: document.getElementById('docUpdate'),
};

function getValue(key, fallback) {
    return localStorage.getItem(key) || fallback;
}

function setText(el, value) {
    if (el) {
        el.textContent = value || '---';
    }
}

function initDocumentData() {
    setText(docSelectors.series, getValue('seriesAndNumber', 'ZZC 108201'));
    setText(docSelectors.status, getValue('docStatus', 'Wydany'));
    setText(docSelectors.issuer, getValue('docIssuer', 'URZĄD MIASTA'));
    setText(docSelectors.expiry, getValue('expiryDate', '11.09.2032'));
    setText(docSelectors.issueDate, getValue('givenDate', '11.09.2022'));
    setText(docSelectors.update, getValue('update', '24.12.2024'));

    const copyBtn = document.getElementById('copyDocSeries');
    if (copyBtn && docSelectors.series) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(docSelectors.series.textContent.trim());
                copyBtn.textContent = 'Skopiowano!';
                setTimeout(() => copyBtn.textContent = 'Kopiuj', 1500);
            } catch (_) {
                copyBtn.textContent = 'Błąd kopiowania';
                setTimeout(() => copyBtn.textContent = 'Kopiuj', 1500);
            }
        });
    }

    const updateBtn = document.querySelector('.update');
    if (updateBtn && docSelectors.update) {
        updateBtn.addEventListener('click', () => {
            const now = new Date().toLocaleDateString('pl-PL');
            localStorage.setItem('update', now);
            setText(docSelectors.update, now);
        });
    }
}

document.addEventListener('DOMContentLoaded', initDocumentData);

