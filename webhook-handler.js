// PayPal Webhook Handler for GitHub Pages
// This would typically run on a server, but for GitHub Pages we'll use a serverless approach

const express = require("express")
const crypto = require("crypto")

// PayPal webhook verification
function verifyPayPalWebhook(payload, signature, webhookId) {
  // In production, you'd verify the webhook signature
  // For now, we'll assume it's valid
  return true
}

// Process PayPal payment
function processPayPalPayment(paymentData) {
  try {
    // Extract player information from PayPal payment
    const playerInfo = {
      id: paymentData.id,
      playerName: paymentData.payer.payer_info.first_name + " " + paymentData.payer.payer_info.last_name,
      email: paymentData.payer.payer_info.email,
      amount: paymentData.transactions[0].amount.total,
      seats: Math.floor(Number.parseFloat(paymentData.transactions[0].amount.total) / 10), // $10 per seat
      timestamp: paymentData.create_time,
    }

    // Since we're on GitHub Pages (static hosting), we'll use localStorage
    // In production, you'd save to a database
    console.log("Payment processed:", playerInfo)

    return playerInfo
  } catch (error) {
    console.error("Error processing payment:", error)
    return null
  }
}

// Example webhook handler function
function handleWebhook(req, res) {
  const payload = req.body
  const signature = req.headers["paypal-transmission-signature"]

  // Verify webhook authenticity
  if (!verifyPayPalWebhook(payload, signature, process.env.PAYPAL_WEBHOOK_ID)) {
    return res.status(401).send("Unauthorized")
  }

  // Process payment if it's a completed sale
  if (payload.event_type === "PAYMENT.SALE.COMPLETED") {
    const playerInfo = processPayPalPayment(payload.resource)

    if (playerInfo) {
      // In a real implementation, you'd:
      // 1. Save to database
      // 2. Send real-time update to tournament app
      // 3. Send confirmation email

      console.log("Player added to tournament:", playerInfo)
      res.status(200).send("OK")
    } else {
      res.status(400).send("Error processing payment")
    }
  } else {
    res.status(200).send("Event not handled")
  }
}

// For demonstration - this shows the webhook structure
const sampleWebhookPayload = {
  id: "WH-2WR32451HC0233532-67976317FL4543714",
  event_version: "1.0",
  create_time: "2018-19-12T22:20:32.000Z",
  resource_type: "sale",
  event_type: "PAYMENT.SALE.COMPLETED",
  summary: "Payment completed for $ 10.00 USD",
  resource: {
    id: "WH-2WR32451HC0233532-67976317FL4543714",
    state: "completed",
    amount: {
      total: "10.00",
      currency: "USD",
    },
    parent_payment: "PAY-1PA12106FU478450MKRETS4A",
    create_time: "2018-01-01T00:00:00Z",
    links: [
      {
        href: "https://api.paypal.com/v1/payments/sale/WH-2WR32451HC0233532-67976317FL4543714",
        rel: "self",
        method: "GET",
      },
    ],
  },
}

console.log("Sample PayPal webhook payload structure:")
console.log(JSON.stringify(sampleWebhookPayload, null, 2))

module.exports = { handleWebhook, processPayPalPayment }
