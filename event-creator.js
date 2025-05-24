// Event Creator Backend Script
// This script creates new Magic: The Gathering events and automatically sets up Google Sheets

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Configuration
const GOOGLE_SERVICE_ACCOUNT_EMAIL = 'your-service-account@your-project.iam.gserviceaccount.com';
const GOOGLE_PRIVATE_KEY = 'your-private-key-here'; // Replace with your actual private key
const GOOGLE_DRIVE_FOLDER_ID = 'your-drive-folder-id'; // Optional: folder to organize sheets

class EventCreator {
    constructor() {
        this.serviceAccountAuth = new JWT({
            email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: GOOGLE_PRIVATE_KEY,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
        });
    }

    // Get current week's date range
    getCurrentWeekDates() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        return { start: weekStart, end: weekEnd };
    }

    // Validate event date is within current week
    validateEventDate(eventDate) {
        const { start, end } = this.getCurrentWeekDates();
        const date = new Date(eventDate);
        
        if (date < start || date > end) {
            throw new Error('Event must be within the current week (Sunday to Saturday)');
        }
        
        return true;
    }

    // Create a new Google Sheet for the event
    async createEventSheet(eventData) {
        try {
            // Validate event date
            this.validateEventDate(eventData.date);

            // Create new spreadsheet
            const doc = new GoogleSpreadsheet();
            
            //moved doc.useServiceAccountAuth outside of try catch block to prevent conditional hook call
            await doc.useServiceAccountAuth(this.serviceAccountAuth);

            // Create the spreadsheet
            await doc.createNewSpreadsheetDocument({
                title: `MTG Event - ${eventData.date} - ${eventData.name}`,
                locale: 'en_US',
                timeZone: 'America/New_York'
            });

            console.log(`Created new spreadsheet: ${doc.spreadsheetId}`);

            // Set up the main sheet
            const sheet = doc.sheetsByIndex[0];
            await sheet.updateProperties({ title: 'Reservations' });

            // Add headers
            await sheet.setHeaderRow([
                'Seat #',
                'Player Name', 
                'Email',
                'Payment Status',
                'Payment ID',
                'Timestamp',
                'Notes'
            ]);

            // Add 20 rows for seats
            const rows = [];
            for (let i = 1; i <= 20; i++) {
                rows.push({
                    'Seat #': i,
                    'Player Name': '',
                    'Email': '',
                    'Payment Status': 'Available',
                    'Payment ID': '',
                    'Timestamp': '',
                    'Notes': ''
                });
            }
            await sheet.addRows(rows);

            // Format the sheet
            await sheet.loadCells('A1:G21');
            
            // Header formatting
            for (let col = 0; col < 7; col++) {
                const cell = sheet.getCell(0, col);
                cell.textFormat = { bold: true };
                cell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
            }

            // Seat number formatting
            for (let row = 1; row <= 20; row++) {
                const seatCell = sheet.getCell(row, 0);
                seatCell.textFormat = { bold: true };
                seatCell.backgroundColor = { red: 0.95, green: 0.95, blue: 1 };
            }

            await sheet.saveUpdatedCells();

            // Create event info sheet
            const infoSheet = await doc.addSheet({ 
                title: 'Event Info',
                headerValues: ['Property', 'Value']
            });

            await infoSheet.addRows([
                { Property: 'Event Name', Value: eventData.name },
                { Property: 'Event Date', Value: eventData.date },
                { Property: 'Event Time', Value: eventData.time || '8:30 PM - 10:30 PM' },
                { Property: 'Entry Fee', Value: eventData.fee || '$10.00' },
                { Property: 'Max Capacity', Value: '20 players' },
                { Property: 'Prize', Value: eventData.prize || '1-2 booster packs + next week seat' },
                { Property: 'Created', Value: new Date().toISOString() },
                { Property: 'Status', Value: 'Active' }
            ]);

            // Make sheet publicly viewable
            await doc.share('anyone', 'reader');

            console.log(`Event created successfully!`);
            console.log(`Sheet ID: ${doc.spreadsheetId}`);
            console.log(`Sheet URL: https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}`);

            return {
                success: true,
                sheetId: doc.spreadsheetId,
                sheetUrl: `https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}`,
                eventData: eventData
            };

        } catch (error) {
            console.error('Error creating event:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create multiple events at once
    async createMultipleEvents(eventsArray) {
        const results = [];
        
        for (const eventData of eventsArray) {
            const result = await this.createEventSheet(eventData);
            results.push(result);
            
            // Add delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return results;
    }
}

// Usage examples
async function createWeeklyEvents() {
    const creator = new EventCreator();
    
    // Example: Create this week's events
    const events = [
        {
            date: '2024-01-26', // This Friday
            name: 'Commander',
            time: '8:30 PM - 10:30 PM',
            fee: '$10.00',
            prize: '1-2 booster packs + next week seat'
        }
        // Add more events as needed:
        // {
        //     date: '2024-01-24', // Wednesday
        //     name: 'Standard',
        //     time: '7:00 PM - 9:00 PM',
        //     fee: '$15.00'
        // }
    ];
    
    const results = await creator.createMultipleEvents(events);
    
    results.forEach((result, index) => {
        if (result.success) {
            console.log(`✅ Event ${index + 1} created successfully`);
            console.log(`   Sheet URL: ${result.sheetUrl}`);
        } else {
            console.log(`❌ Event ${index + 1} failed: ${result.error}`);
        }
    });
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node event-creator.js <date> <name> [time] [fee]');
        console.log('Example: node event-creator.js 2024-01-26 Commander "8:30 PM - 10:30 PM" "$10.00"');
        process.exit(1);
    }
    
    const [date, name, time, fee] = args;
    
    const creator = new EventCreator();
    creator.createEventSheet({
        date,
        name,
        time: time || '8:30 PM - 10:30 PM',
        fee: fee || '$10.00'
    }).then(result => {
        if (result.success) {
            console.log('✅ Event created successfully!');
            console.log(`Sheet URL: ${result.sheetUrl}`);
        } else {
            console.log(`❌ Failed to create event: ${result.error}`);
        }
    });
}

module.exports = EventCreator;
