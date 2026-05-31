window.goToCreator = function() {
    localStorage.removeItem('hasUserData');
    localStorage.removeItem('top');
    localStorage.removeItem('bottom');
    localStorage.removeItem('seriesAndNumber');
    localStorage.removeItem('birthDay');
    localStorage.removeItem('givenDate');
    localStorage.removeItem('expiryDate');
    window.location.href = 'index.html?creator=1';
};


