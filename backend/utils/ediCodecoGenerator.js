const ISO_SIZE_TYPE_MAP = {
    '20FT': '22G1',
    '40FT': '42G1',
    '40FT_HC': '45G1',
    'REEFER': '45R1'
};

function formatEdifactTimestamp(dateInput = new Date()) {
    const d = new Date(dateInput);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function generateCodecoMessage({
    movementType, // 'GATE_IN' | 'GATE_OUT'
    container,
    truckPlate = '',
    sealNumber = '',
    eirReference = '',
    depotCode = 'KEATHI01',
    senderId = 'D2TRANSPORT'
}) {
    const msgRef = `${Date.now()}`;
    const bgmCode = movementType === 'GATE_OUT' ? '36' : '34';
    const eqdAction = movementType === 'GATE_OUT' ? '3' : '2';
    const isoCode = ISO_SIZE_TYPE_MAP[container.container_type] || '42G1';
    const fullEmpty = container.status === 'Allocated' ? '5' : '4'; // 4 = Empty, 5 = Full
    const timestamp = formatEdifactTimestamp(new Date());
    const principalCode = (container.principal_name || 'LINE').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) || 'LINE';

    const segments = [
        `UNB+UNOA:2+${senderId}+${principalCode}+${timestamp.slice(2, 8)}:${timestamp.slice(8, 12)}+${msgRef}'`,
        `UNH+${msgRef}+CODECO:D:95B:UN:SMDG16'`,
        `BGM+${bgmCode}+${eirReference || msgRef}+9'`,
        `NAD+MS+${senderId}'`,
        `NAD+MR+${principalCode}'`,
        `EQD+CN+${container.container_number}+${isoCode}:102:5++${eqdAction}+${fullEmpty}'`,
        `DTM+7:${timestamp}:203'`,
        `LOC+165+KEATH:139:6+${depotCode}:TER:ZZZ'`
    ];

    if (sealNumber) {
        segments.push(`SEL+${sealNumber}+CA'`);
    }
    if (container.condition_status === 'Damaged') {
        segments.push(`DAM+1+DMG'`);
    }
    if (truckPlate) {
        segments.push(`TDT+1++3+++++${truckPlate.replace(/\s+/g, '')}:146'`);
    }

    segments.push(`CNT+16:1'`);
    segments.push(`UNT+${segments.length}+${msgRef}'`);
    segments.push(`UNZ+1+${msgRef}'`);

    return segments.join('\n');
}

module.exports = { generateCodecoMessage };