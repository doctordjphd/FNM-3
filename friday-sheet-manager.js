const { GoogleSpreadsheet } = require("google-spreadsheet")
const { JWT } = require("google-auth-library")

// Configuration
const SERVICE_ACCOUNT_EMAIL = "your-service-account@your-project.iam.gserviceaccount.com"
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----`

// Initialize auth
const serviceAccountAuth = new JWT({
  email: SERVICE_ACCOUNT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
})

// Generate all Fridays from June 14 to September 30, 2024
function generateFridayDates() {
  const fridays = []
  const startDate = new Date("2024-06-14") // June 14, 2024 (Friday)
  const endDate = new Date("2024-09-30") // End of September

  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    fridays.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 7) // Next Friday
  }

  return fridays
}

// Create a Google Sheet for a specific Friday
async function createFridaySheet(date) {
  try {
    const dateStr = date.toISOString().split("T")[0]
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    // Create new spreadsheet
    const doc = new GoogleSpreadsheet()

    await doc.useServiceAccountAuth(serviceAccountAuth)

    await doc.createNewSpreadsheetDocument({
      title: `FNM Commander - ${formattedDate}`,
    })

    console.log(`Created sheet: ${doc.spreadsheetId} for ${formattedDate}`)

    // Set up the sheet
    await doc.loadInfo()
    const sheet = doc.sheetsByIndex[0]
    await sheet.updateProperties({ title: "Reservations" })

    // Add headers
    await sheet.setHeaderRow(["Seat #", "Player Name", "Email", "Phone", "Payment Status", "Reservation Time", "Notes"])

    // Add 20 seats
    const rows = []
    for (let i = 1; i <= 20; i++) {
      rows.push({
        "Seat #": i,
        "Player Name": "",
        Email: "",
        Phone: "",
        "Payment Status": "Pending",
        "Reservation Time": "",
        Notes: "",
      })
    }

    await sheet.addRows(rows)

    // Make sheet publicly viewable
    await doc.updateProperties({
      locale: "en_US",
      timeZone: "America/New_York",
    })

    // Share with public (view only)
    await doc.share("", {
      role: "reader",
      type: "anyone",
    })

    return {
      date: dateStr,
      sheetId: doc.spreadsheetId,
      title: `FNM Commander - ${formattedDate}`,
    }
  } catch (error) {
    console.error(`Error creating sheet for ${date}:`, error)
    throw error
  }
}

// Create all Friday sheets
async function createAllFridaySheets() {
  const fridays = generateFridayDates()
  const results = []

  console.log(`Creating ${fridays.length} Friday sheets...`)

  for (const friday of fridays) {
    try {
      const result = await createFridaySheet(friday)
      results.push(result)
      console.log(`✅ Created: ${result.title} (${result.sheetId})`)

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`❌ Failed to create sheet for ${friday}:`, error.message)
    }
  }

  // Output the mapping for employee.html
  console.log("\n📋 Copy this mapping to employee.html:")
  console.log("const FRIDAY_SHEETS = {")
  results.forEach((result) => {
    console.log(`    '${result.date}': '${result.sheetId}',`)
  })
  console.log("};")

  return results
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2]

  if (command === "create") {
    createAllFridaySheets()
      .then((results) => {
        console.log(`\n🎉 Successfully created ${results.length} Friday sheets!`)
        process.exit(0)
      })
      .catch((error) => {
        console.error("❌ Error:", error)
        process.exit(1)
      })
  } else {
    console.log("Usage: node friday-sheet-manager.js create")
    process.exit(1)
  }
}

module.exports = {
  createFridaySheet,
  createAllFridaySheets,
  generateFridayDates,
}
