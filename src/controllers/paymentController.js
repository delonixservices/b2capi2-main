// const Api = require("../services/apiService");
// const Mail = require("../services/mailService");
// const Sms = require('../services/smsService');

// const ccavanue = require('../utils/ccavanue');
// const jtfd = require("json-to-form-data");
// const {
//   payment_url,
//   merchant_id,
//   accessCode,
//   workingKey,
// } = require('../config/payment');

// const {
//   baseUrl,
//   clientUrl
// } = require('../config/index');

// const Transaction = require('../models/HotelTransaction');

// const url = require('url');

// const invoice = require('../utils/invoice');
// const voucher = require('../utils/voucher');

// const logger = require('../config/logger');

// exports.processPayment = async (req, res, next) => {

//   if (!req.params.id) {
//     const error = new Error('Booking Id is required');
//     error.statusCode = 400;
//     return next(error);
//   }

//   let data;
//   try {
//     data = await Transaction.findOne({
//       "prebook_response.data.booking_id": req.params.id
//     });
//   } catch (err) {
//     return next(err);
//   }

//   if (!data) {
//     const error = new Error('Sorry invalid Booking ID, try another id');
//     error.statusCode = 404;
//     return next(error);
//   }

//   if (!data.prebook_response) {
//     const error = new Error('Transaction is not complete. Please try again.');
//     error.statusCode = 500;
//     return next(error);
//   }

//   const createdAt = new Date(data.created_at).getTime();
//   // check if booking session is expired
//   // booking session will be expired after 20 (20*60*1000 milliseconds) minutes of prebook
//   const expiry = createdAt + 20 * 60 * 1000;
//   const isExpired = Date.now() > expiry;

//   // console.log(isExpired, createdAt, Date.now())

//   if (isExpired) {
//     console.log("Booking session expired. Cannot process payment.");
//     const error = new Error('Booking session expired. Please try again.');
//     error.statusCode = 422;
//     return next(error);
//   }

//   if (data.payment_response && data.payment_response.order_status === "Success") {
//     console.log("Payment is already done");
//     const error = new Error('Booking session expired. Please try again!');
//     error.statusCode = 422;
//     return next(error);
//   }

//   data.status = 3; // payment pending
//   await data.save();

//   const payload = {
//     merchant_id: merchant_id,
//     order_id: data._id,
//     currency: data.pricing.currency,
//     billing_name: data.contactDetail.name,
//     billing_email: data.contactDetail.email,
//     billing_tel: data.contactDetail.mobile,
//     booking_id: req.params.id,
//     amount: data.pricing.total_chargeable_amount,
//     redirect_url: `${baseUrl}/api/hotels/payment-response-handler`,
//     cancel_url: `${baseUrl}/api/hotels/payment-response-handler`,
//     language: 'EN'
//   };

//   console.log(payload);

//   const formDataString = jtfd(payload);

//   const encRequest = ccavanue.encrypt(formDataString, workingKey);

//   const formbody = '<form id="nonseamless" method="post" name="redirect" action="' + payment_url + '"/> <input type="hidden" id="encRequest" name="encRequest" value="' + encRequest + '"><input type="hidden" name="access_code" id="access_code" value="' + accessCode + '"><script language="javascript">document.redirect.submit();</script></form>';
//   res.send(formbody);
// };

// exports.paymentResponseHandler = async (req, res, next) => {
//   console.log('Payment response...');
//   console.log(req.body);

//   const orderNo = req.body.orderNo;
//   const encResp = req.body.encResp;

//   const bookingFailedMsg = `Due to some technical problem the booking is not confirmed. The amount will be refunded if it is deducted from your account. Kindly book again.  Please write an email to support@delonixtravel.com incase of further queries.`;

//   if (!orderNo) {
//     const error = new Error('OrderNo missing from payment_response from ccavanue.');
//     error.statusCode = 500;
//     return next(error);
//   }
//   // console.log('Booking ID: ' + orderNo);
//   const dataObj = await Transaction.findById(orderNo);
//   // console.log(dataObj);
//   if (!dataObj) {
//     const error = new Error('Sorry invalid OrderNo, cannot find any transaction with this order no');
//     error.statusCode = 500;
//     return next(error);
//   }

//   const paymentData = ccavanue.decrypt(encResp, workingKey);
//   const queryStrings = url.parse("/?" + paymentData, true).query;
//   //storing payment response
//   dataObj.payment_response = queryStrings;

//   if (queryStrings.order_status === "Success") {
//     // redirect to success

//     dataObj.status = 4; // payment success
//     await dataObj.save();

//     // doing the actual booking
//     let data;
//     try {
//       data = await Api.hotels.post("/book", {
//         "book": {
//           "booking_id": dataObj.prebook_response.data.booking_id
//         }
//       });
//     } catch (err) {
//       logger.error(err);
//       logger.info(err);
//       logger.log(`log + ${err}`);
//       const error = new Error(bookingFailedMsg);
//       error.statusCode = 500;

//       dataObj.status = 5; // booking failed
//       dataObj.save();

//       return next(error);
//     }

//     if (!data || !data.data) {
//       console.log(data);
//       return res.status(500).send(bookingFailedMsg);
//     }

//     dataObj.status = 1; // booking_success
//     dataObj.book_response = data;

//     // @TODO:- handle if data response is not saved in db
//     try {
//       await dataObj.save();
//     } catch (err) {
//       logger.log(`hotel book_response not saved.. Error ${err}`);
//     }

//     const {
//       _id: bookingId,
//       contactDetail,
//       hotel,
//       pricing
//     } = dataObj;

//     const smsGuest = `Dear ${contactDetail.name}, Your Hotel ${hotel.originalName} has been booked and the bookingId is ${bookingId}. Thank you !`;

//     const smsAdmin = `Hello Admin, new booking received. bookingId: ${bookingId}, Guest name: ${contactDetail.name} ${contactDetail.last_name}, Hotel name: ${hotel.originalName}, Amount: ${pricing.currency} ${pricing.total_chargeable_amount}, Payment mode: ${queryStrings.payment_mode}, Location: ${hotel.location.address}, ${hotel.location.city}, ${hotel.location.country ? hotel.location.country : hotel.location.countryCode}`;

//     try {
//       const guestRes = Sms.send(contactDetail.mobile, smsGuest);
//       const adminRes = Sms.send("917678105666", smsAdmin);

//       Promise.all([guestRes, adminRes])
//         .then((data) => {
//           console.log(data);
//           console.log("sms sent successfully");
//         })
//         .catch((err) => {
//           throw err;
//         })

//       // if (guestRes.type != "success") {
//       //   throw new Error('Failed to send the sms');
//       // }

//       // if (adminRes.type != "success") {
//       //   throw new Error('Failed to send the sms');
//       // }

//       // if (admin2Res.type != "success") {
//       //   throw new Error('');
//       // }

//     } catch (err) {
//       console.log("Failed to send the sms", err);
//     }

//     let invoiceBuffer = await invoice.generateInvoice(dataObj);
//     invoiceBuffer = invoiceBuffer.toString('base64');
//     let voucherBuffer = await voucher.generateVoucher(dataObj);
//     voucherBuffer = voucherBuffer.toString('base64');

//     const msg = {
//       to: dataObj.contactDetail.email,
//       subject: 'TripBazaar Confim Ticket',
//       text: `Dear ${contactDetail.name}, Your Hotel ${hotel.originalName} has been booked and the bookingId is ${bookingId}. Thank you !`,
//       attachments: [{
//         filename: 'Invoice.pdf',
//         content: invoiceBuffer,
//         type: 'application/pdf',
//         disposition: 'attachment',
//         contentId: 'myId'
//       }, {
//         filename: 'Voucher.pdf',
//         content: voucherBuffer,
//         type: 'application/pdf',
//         disposition: 'attachment',
//         contentId: 'myId'
//       }],
//       html: `Dear ${contactDetail.name}, Your Hotel ${hotel.originalName} has been booked and the booking reference no. is ${bookingId}. Thank you !`,
//     };

//     const msgAdmin = {
//       to: 'ankit.phondani@delonixtravel.com',
//       subject: 'TripBazaar Confim Ticket',
//       html: `Hello Admin, new booking received. bookingId: ${bookingId}, Hotel name: ${hotel.originalName}, Amount: ${pricing.currency} ${pricing.total_chargeable_amount}, Payment mode: ${queryStrings.payment_mode}, Location: ${hotel.location.address}, ${hotel.location.city}, ${hotel.location.country ? hotel.location.country : hotel.location.countryCode}`,
//       attachments: [{
//           filename: 'Invoice.pdf',
//           content: invoiceBuffer,
//           type: 'application/pdf',
//           disposition: 'attachment',
//           contentId: 'myId1'
//         },
//         {
//           filename: 'Voucher.pdf',
//           content: voucherBuffer,
//           type: 'application/pdf',
//           disposition: 'attachment',
//           contentId: 'myId2'
//         }
//       ]
//     };
//     try {
//       Mail.send(msg);
//       Mail.send(msgAdmin);
//     } catch (err) {
//       console.log("Failed to send mail", err);
//     }
//     res.redirect(`${clientUrl}/hotels/hotelvoucher?id=${dataObj._id}`);
//   } else {
//     // redirect to failed page
//     dataObj.status = 6; // payment failed 
//     dataObj.save();
//     // res.redirect(`${clientUrl}/hotels/hoteldetails`);
//     return res.status(500).send(bookingFailedMsg);
//   }
// };

const Razorpay = require('razorpay');
const crypto = require('crypto');
const Api = require("../services/apiService");
const Mail = require("../services/mailService");
const Sms = require('../services/smsService');
const {
  razorpay_key_id,
  razorpay_key_secret,
  clientUrl,
  adminPhone,
  adminEmail
} = require('../config/payment');
const Transaction = require('../models/HotelTransaction');
const invoice = require('../utils/invoice');
const voucher = require('../utils/voucher');
const logger = require('../config/logger');

// Transaction Status Constants
const TXN_STATUS = {
  PAYMENT_PENDING: 3,
  PAYMENT_SUCCESS: 4,
  BOOKING_SUCCESS: 1,
  BOOKING_FAILED: 5
};

const razorpay = new Razorpay({
  key_id: razorpay_key_id,
  key_secret: razorpay_key_secret
});

exports.processPayment = async (req, res, next) => {
  try {
    const { id: bookingId } = req.params;
    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    const transaction = await Transaction.findOne({
      "prebook_response.data.booking_id": bookingId
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.payment_response?.status === "success") {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    const TWENTY_MINUTES = 20 * 60 * 1000;
    const isExpired = Date.now() > new Date(transaction.created_at).getTime() + TWENTY_MINUTES;
    if (isExpired) {
      return res.status(400).json({ error: 'Booking session expired' });
    }

    transaction.status = TXN_STATUS.PAYMENT_PENDING;
    await transaction.save();

    const amountInSubunits = Math.round(transaction.pricing.total_chargeable_amount * 100);
    const options = {
      amount: amountInSubunits,
      currency: transaction.pricing.currency,
      receipt: transaction._id.toString(),
      payment_capture: 1,
      notes: {
        booking_id: transaction.prebook_response.data.booking_id,
        transaction_id: transaction._id.toString()
      }
    };

    const order = await razorpay.orders.create(options, {
      idempotencyKey: transaction._id.toString()
    });

    transaction.payment_response = { 
      ...transaction.payment_response,
      razorpay_order_id: order.id
    };
    await transaction.save();

    res.json({
      key: razorpay_key_id,
      amount: options.amount,
      currency: options.currency,
      name: "TripBazaar",
      description: "Hotel Booking Payment",
      order_id: order.id,
      prefill: {
        name: transaction.contactDetail.name,
        email: transaction.contactDetail.email,
        contact: transaction.contactDetail.mobile
      }
    });
  } catch (err) {
    logger.error(`Payment initiation failed: ${err.message}`, { error: err });
    next(err);
  }
};

exports.handleWebhook = async (req, res) => {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookBody = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', razorpay_key_secret)
    .update(webhookBody)
    .digest('hex');

  if (expectedSignature !== webhookSignature) {
    logger.warn('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }

  const { event, payload } = req.body;
  if (event !== 'payment.captured') {
    return res.status(200).send('Event not handled');
  }

  try {
    const payment = payload.payment.entity;
    const transaction = await Transaction.findOne({
      "payment_response.razorpay_order_id": payment.order_id
    });

    if (!transaction) {
      logger.error('Transaction not found for webhook', { paymentId: payment.id });
      return res.status(404).send('Transaction not found');
    }

    if (transaction.payment_response?.status === "success") {
      return res.status(200).send('Payment already processed');
    }

    transaction.payment_response = {
      ...transaction.payment_response,
      razorpay_payment_id: payment.id,
      status: "success"
    };
    transaction.status = TXN_STATUS.PAYMENT_SUCCESS;
    await transaction.save();

    const bookingResponse = await Api.hotels.post("/book", {
      book: { booking_id: transaction.prebook_response.data.booking_id }
    });

    if (!bookingResponse?.data) {
      throw new Error("Hotel booking API failed");
    }

    transaction.status = TXN_STATUS.BOOKING_SUCCESS;
    transaction.book_response = bookingResponse;
    await transaction.save();

    await sendConfirmationNotifications(transaction);
    await sendAdminNotifications(transaction);

    res.status(200).send('Webhook processed');
  } catch (err) {
    logger.error(`Webhook processing failed: ${err.message}`, { error: err });
    await handleBookingFailure(req.body, err);
    res.status(500).send('Processing failed');
  }
};

async function sendConfirmationNotifications(transaction) {
  try {
    const { contactDetail, hotel, pricing, _id: bookingId } = transaction;
    const smsText = `Dear ${contactDetail.name}, Your booking at ${hotel.originalName} is confirmed. Booking ID: ${bookingId}`;
    
    const [invoiceBuffer, voucherBuffer] = await Promise.all([
      invoice.generateInvoice(transaction),
      voucher.generateVoucher(transaction)
    ]);

    const emailAttachments = [
      {
        filename: 'Invoice.pdf',
        content: invoiceBuffer,
        encoding: 'base64'
      },
      {
        filename: 'Voucher.pdf',
        content: voucherBuffer,
        encoding: 'base64'
      }
    ];

    await Promise.allSettled([
      Sms.send(contactDetail.mobile, smsText),
      Mail.send({
        to: contactDetail.email,
        subject: 'Booking Confirmation',
        text: smsText,
        attachments: emailAttachments
      })
    ]);
  } catch (err) {
    logger.error('Notification sending failed', { error: err });
  }
}

async function sendAdminNotifications(transaction) {
  const { contactDetail, hotel, pricing, _id: bookingId } = transaction;
  const adminMessage = `New booking: ${bookingId}\nGuest: ${contactDetail.name}\nHotel: ${hotel.originalName}\nAmount: ${pricing.currency} ${pricing.total_chargeable_amount}`;

  await Promise.allSettled([
    Sms.send(adminPhone, adminMessage),
    Mail.send({
      to: adminEmail,
      subject: 'New Hotel Booking',
      text: adminMessage
    })
  ]);
}

async function handleBookingFailure(paymentData, error) {
  try {
    const transaction = await Transaction.findOne({
      "payment_response.razorpay_order_id": paymentData.payload.payment.entity.order_id
    });

    if (!transaction) return;

    transaction.status = TXN_STATUS.BOOKING_FAILED;
    await transaction.save();
    
    // Initiate refund
    await razorpay.payments.refund(paymentData.payload.payment.entity.id, {
      amount: transaction.pricing.total_chargeable_amount * 100
    });

    logger.info(`Initiated refund for failed booking: ${transaction._id}`);
  } catch (refundError) {
    logger.error('Refund processing failed', { error: refundError });
  }
}