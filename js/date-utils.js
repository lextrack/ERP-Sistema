const DateUtils = {
    /**
     * Convierte una cadena de fecha en formato YYYY-MM-DD a un objeto Date
     * @param {string} dateString - Fecha en formato YYYY-MM-DD
     * @returns {Date} Objeto Date
     */
    parseInputDate: function(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('-');
        if (parts.length !== 3) return null;
        return new Date(
            parseInt(parts[0]),
            parseInt(parts[1]) - 1,
            parseInt(parts[2])
        );
    },

    /**
     * Convierte un objeto Date a una cadena en formato YYYY-MM-DD para inputs
     * @param {Date} date - Objeto Date
     * @returns {string} Fecha en formato YYYY-MM-DD
     */
    formatForInput: function(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Formatea una fecha para mostrar al usuario
     * @param {Date} date - Objeto Date
     * @returns {string} Fecha formateada para mostrar
     */
    formatDisplay: function(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return '-';
        return date.toLocaleDateString();
    },

    /**
     * Obtiene la fecha actual formateada para inputs
     * @returns {string} Fecha actual en formato YYYY-MM-DD
     */
    getTodayFormatted: function() {
        return this.formatForInput(new Date());
    },

    /**
     * Compara dos fechas para ordenamiento
     * @param {Date} date1 - Primera fecha
     * @param {Date} date2 - Segunda fecha
     * @returns {number} Negativo si date1 < date2, positivo si date1 > date2, 0 si son iguales
     */
    compareDates: function(date1, date2) {
        const d1 = date1 instanceof Date ? date1 : new Date(date1);
        const d2 = date2 instanceof Date ? date2 : new Date(date2);
        return d1 - d2;
    },

    /**
     * Verifica si una fecha está en un rango
     * @param {Date} date - Fecha a verificar
     * @param {Date} startDate - Fecha de inicio
     * @param {Date} endDate - Fecha de fin
     * @returns {boolean} true si la fecha está en el rango
     */
    isInRange: function(date, startDate, endDate) {
        if (!date) return false;
        const d = date instanceof Date ? date : new Date(date);
        const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
        const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
        
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    },

    /**
     * Obtiene el primer día del mes
     * @param {number} month - Mes (0-11)
     * @param {number} year - Año
     * @returns {Date} Primer día del mes
     */
    getFirstDayOfMonth: function(month, year) {
        return new Date(year, month, 1);
    },

    /**
     * Obtiene el último día del mes
     * @param {number} month - Mes (0-11)
     * @param {number} year - Año
     * @returns {Date} Último día del mes
     */
    getLastDayOfMonth: function(month, year) {
        return new Date(year, month + 1, 0);
    },

    /**
     * Obtiene el nombre del mes
     * @param {number} month - Mes (0-11)
     * @returns {string} Nombre del mes
     */
    getMonthName: function(month) {
        const date = new Date();
        date.setMonth(month);
        return date.toLocaleString('es-ES', { month: 'long' });
    }
};