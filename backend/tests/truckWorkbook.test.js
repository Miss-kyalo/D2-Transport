const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { createTruckTemplate, readTruckWorkbook } = require('../utils/truckWorkbook');

async function workbookWithRows(rows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trucks');
    sheet.addRow(['plate_number', 'model', 'capacity_tons']);
    rows.forEach((row) => sheet.addRow(row));
    return workbook.xlsx.writeBuffer();
}

test('template has a blank import sheet and a separate example', async () => {
    const buffer = await createTruckTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    assert.equal(workbook.getWorksheet('Trucks').rowCount, 1);
    assert.equal(workbook.getWorksheet('Example - do not import').getRow(2).getCell(1).value, 'KAA 123A');
    const result = await readTruckWorkbook(buffer);
    assert.match(result.errors[0], /no trucks/i);
});

test('reads valid rows and rejects invalid and duplicate plate rows', async () => {
    const valid = await readTruckWorkbook(await workbookWithRows([[' KAA 001A ', 'Truck', 1.15], ['KBB 002B', 'Truck 2', 30]]));
    assert.deepEqual(valid.errors, []);
    assert.deepEqual(valid.trucks[0], { row: 2, plate_number: 'KAA 001A', model: 'Truck', capacity_tons: 1.15 });

    const invalid = await readTruckWorkbook(await workbookWithRows([['KAA 001A', 'Truck', 30], ['kaa 001a', 'Truck', 20], ['KBB', '', 0]]));
    assert.equal(invalid.errors.length, 2);
    assert.match(invalid.errors[0], /Row 3.*duplicate/i);
    assert.match(invalid.errors[1], /Row 4/);
});

test('rejects formula cells and invalid precision', async () => {
    const result = await readTruckWorkbook(await workbookWithRows([['KAA', 'Truck', { formula: '1+1', result: 2 }], ['KBB', 'Truck', 1.234]]));
    assert.equal(result.errors.length, 2);
});
