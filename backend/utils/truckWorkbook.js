const ExcelJS = require('exceljs');

const HEADERS = ['plate_number', 'model', 'capacity_tons'];
const MAX_TRUCKS = 1000;

async function createTruckTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trucks');
    sheet.addRow(HEADERS);
    sheet.columns.forEach((column) => { column.width = 22; });
    const example = workbook.addWorksheet('Example - do not import');
    example.addRow(HEADERS);
    example.addRow(['KAA 123A', 'Example truck', 30]);
    example.columns.forEach((column) => { column.width = 22; });
    return workbook.xlsx.writeBuffer();
}

async function readTruckWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Trucks');
    if (!sheet) return { trucks: [], errors: ['The workbook must contain a Trucks worksheet.'] };
    if (sheet.rowCount > MAX_TRUCKS + 1) {
        return { trucks: [], errors: [`The Trucks worksheet may contain at most ${MAX_TRUCKS} data rows.`] };
    }

    const header = sheet.getRow(1);
    if (HEADERS.some((name, index) => header.getCell(index + 1).value !== name)) {
        return { trucks: [], errors: [`Row 1 must contain these columns in order: ${HEADERS.join(', ')}.`] };
    }

    const trucks = [];
    const errors = [];
    const plates = new Set();
    for (let number = 2; number <= sheet.rowCount; number += 1) {
        const row = sheet.getRow(number);
        const values = HEADERS.map((_, index) => row.getCell(index + 1).value);
        if (values.every((value) => value === null || value === undefined || value === '')) continue;
        const [plateValue, modelValue, capacityValue] = values;
        const plate = typeof plateValue === 'string' ? plateValue.trim() : '';
        const model = typeof modelValue === 'string' ? modelValue.trim() : '';
        const capacity = typeof capacityValue === 'number' || typeof capacityValue === 'string'
            ? Number(capacityValue) : NaN;
        if (!plate || plate.length > 50 || !model || model.length > 100 ||
            capacityValue === '' || !Number.isFinite(capacity) || capacity <= 0 ||
            capacity > 9999.99 || Math.abs(Math.round(capacity * 100) - capacity * 100) > 1e-8) {
            errors.push(`Row ${number}: enter a plate (max 50 characters), model (max 100 characters), and positive capacity up to 9999.99 with at most two decimal places.`);
            continue;
        }
        const key = plate.toUpperCase();
        if (plates.has(key)) {
            errors.push(`Row ${number}: duplicate plate number ${plate} in workbook.`);
            continue;
        }
        plates.add(key);
        trucks.push({ row: number, plate_number: plate, model, capacity_tons: capacity });
    }
    if (!trucks.length && !errors.length) errors.push('The Trucks worksheet contains no trucks.');
    return { trucks, errors };
}

module.exports = { createTruckTemplate, readTruckWorkbook };
