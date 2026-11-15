
import mongoose from "mongoose";
import ServiceProvider from "../models/serviceProvider.model.js";
import Booking from "../models/booking.model.js";
import { notify } from "../services/notification.service.js";
import ApiError from "../utils/ApiError.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

// Customer can report "provider did not come" this long after accept
export const NO_SHOW_AFTER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a new service booking.
 *
 * @route POST /api/booking/:providerId
 * @access Private (Customer)
 */
export const createBooking = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { providerId } = req.params;
    const { category, description, serviceAddress } = req.body;

    // 1. Validate provider ID
    if (!mongoose.isObjectIdOrHexString(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID",
      });
    }

    // 2. Validate booking details
    if (
      !mongoose.isObjectIdOrHexString(category) ||
      typeof description !== "string" ||
      description.trim().length < 10 ||
      description.trim().length > 1000 ||
      typeof serviceAddress !== "string" ||
      !serviceAddress.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking details",
      });
    }

    // 3. Find approved and available provider
    const provider = await ServiceProvider.findOne({
      _id: providerId,
      verificationStatus: "approved",
      availabilityStatus: "available",
      categories: category,
    }).populate("user", "role isActive");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found or unavailable",
      });
    }

    // 4. Check linked user account
    if (!provider.user) {
      return res.status(404).json({
        success: false,
        message: "Provider user account not found",
      });
    }

    // 5. Verify provider role
    if (provider.user.role !== "provider") {
      return res.status(403).json({
        success: false,
        message: "Provider account is not approved",
      });
    }

    // 6. Check account status (if field exists)
    if (provider.user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Provider account is inactive",
      });
    }

    // 7. Prevent provider from booking themselves
    if (provider.user._id.toString() === customerId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot book your own service",
      });
    }

    // 8. Create booking
    const booking = await Booking.create({
      customer: customerId,
      provider: provider._id,
      category,
      description: description.trim(),
      serviceAddress: serviceAddress.trim(),
      // status defaults to "pending"
    });

    await notify(
      provider.user._id,
      "booking_created",
      `${req.user.name} sent you a new booking request`,
      { booking: booking._id },
    );

    return res.status(201).json({
      success: true,
      message: "Booking request sent successfully",
      booking,
    });
  } catch (error) {
    console.error("Create Booking Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
    });
  }
};




/**
 * Get all bookings created by the logged-in customer.
 *
 * @route GET /api/booking/my
 * @access Private (Customer)
 */
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      customer: req.user._id,
    })
      .populate({
        path: "provider",
        select: "businessName businessPhone location",
        populate: {
          path: "user",
          select: "name phone avatar",
        },
      })
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get My Bookings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};




/**
 * Get all bookings received by the logged-in provider.
 *
 * @route   GET /api/booking/provider
 * @access  Private (Provider)
 * @returns {Promise<void>}
 */
export const getProviderBookings = async (req, res) => {
  try {
    // 1. Find provider profile using logged-in User ID
    const provider = await ServiceProvider.findOne({
      user: req.user._id,
      verificationStatus: "approved",
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found",
      });
    }

    // 2. Get bookings assigned to this provider
    const bookings = await Booking.find({
      provider: provider._id,
    })
      .populate("customer", "name email phone avatar")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Provider bookings fetched successfully",
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get Provider Bookings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch provider bookings",
    });
  }
};



/**
 * Accept or reject a pending booking request.
 *
 * @route   PATCH /api/booking/:bookingId/respond
 * @desc    Allow the assigned provider to accept or reject a booking
 * @access  Private (Provider)
 *
 * @param   {string} req.params.bookingId - Booking document ID
 * @param   {"accept"|"reject"} req.body.action - Provider decision
 * @returns {Promise<void>}
 */
export const respondToBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action } = req.body ?? {};

    // 1. Validate booking ID
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    // 2. Validate action
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'accept' or 'reject'",
      });
    }

    // 3. Find the logged-in provider
    const provider = await ServiceProvider.findOne({
      user: req.user._id,
      verificationStatus: "approved",
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Approved provider profile not found",
      });
    }

    // 4. Start transaction to keep updates consistent
    try {
      let updatedBooking;

      await mongoose.connection.transaction(async (session) => {
        // Accept requires the provider to be available
        if (action === "accept") {
          const reservedProvider =
            await ServiceProvider.findOneAndUpdate(
              {
                _id: provider._id,
                verificationStatus: "approved",
                availabilityStatus: "available",
              },
              {
                $set: { availabilityStatus: "busy" },
              },
              {
                new: true,
                session,
              }
            );

          if (!reservedProvider) {
            const error = new Error(
              "Provider is not available to accept bookings"
            );
            error.statusCode = 409;
            throw error;
          }
        }

        // Only pending bookings belonging to this provider
        // can be accepted or rejected
        updatedBooking = await Booking.findOneAndUpdate(
          {
            _id: bookingId,
            provider: provider._id,
            status: "pending",
          },
          {
            $set:
              action === "accept"
                ? { status: "in_progress", acceptedAt: new Date() }
                : { status: "rejected", reason: String(req.body?.reason || "") },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

        if (!updatedBooking) {
          const error = new Error(
            "Booking not found or already processed"
          );
          error.statusCode = 409;
          throw error;
        }
      });

      await notify(
        updatedBooking.customer,
        action === "accept" ? "booking_accepted" : "booking_rejected",
        action === "accept"
          ? `${req.user.name} accepted your booking and is on the way`
          : `${req.user.name} could not accept your booking`,
        { booking: updatedBooking._id },
      );

      return res.status(200).json({
        success: true,
        message:
          action === "accept"
            ? "Booking accepted successfully"
            : "Booking rejected successfully",
        booking: updatedBooking,
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error("Respond To Booking Error:", error);

    const isWriteConflict =
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError");

    return res.status(
      isWriteConflict ? 409 : error.statusCode || 500
    ).json({
      success: false,
      message: isWriteConflict
        ? "Booking state changed. Please retry."
        : error.statusCode
          ? error.message
          : "Failed to respond to booking",
    });
  }
};







/**
 * Mark an in-progress booking as completed.
 *
 * @route   PATCH /api/booking/:bookingId/complete
 * @desc    Provider completes a booking and becomes available
 * @access  Private (Provider)
 *
 * @param   {string} req.params.bookingId - Booking document ID
 * @returns {Promise<void>}
 */
export const markBookingComplete = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // 1. Validate booking ID
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    // 2. Find logged-in approved provider
    const provider = await ServiceProvider.findOne({
      user: req.user._id,
      verificationStatus: "approved",
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Approved provider profile not found",
      });
    }

    let booking;

    // 3. Update booking and provider availability atomically
    await mongoose.connection.transaction(async (session) => {

      // Complete only the provider's in-progress booking
      booking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          provider: provider._id,
          status: "in_progress",
        },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!booking) {
        const error = new Error(
          "Booking not found or not in progress"
        );
        error.statusCode = 409;
        throw error;
      }

      // 4. Make provider available for the next booking
      const result = await ServiceProvider.updateOne(
        {
          _id: provider._id,
          availabilityStatus: "busy",
        },
        {
          $set: {
            availabilityStatus: "available",
          },
          $inc: { completedJobs: 1 },
        },
        { session }
      );

      // Ensure provider availability was updated
      if (result.matchedCount !== 1) {
        const error = new Error(
          "Provider availability is not in busy state"
        );
        error.statusCode = 409;
        throw error;
      }
    });

    await notify(
      booking.customer,
      "booking_completed",
      `${req.user.name} completed your job. Please leave a review!`,
      { booking: booking._id },
    );

    // 5. Return successful response
    return res.status(200).json({
      success: true,
      message:
        "Booking completed successfully. Provider is now available for new bookings.",
      booking,
      availabilityStatus: "available",
    });

  } catch (error) {
    console.error("Mark Booking Complete Error:", error);

    const isWriteConflict =
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError");

    return res.status(
      isWriteConflict ? 409 : error.statusCode || 500
    ).json({
      success: false,
      message: isWriteConflict
        ? "Booking state changed. Please retry."
        : error.statusCode
          ? error.message
          : "Failed to complete booking",
    });
  }
};



/**
 * Inside a transaction: make a busy provider available again.
 * Used when a job ends without completing (cancel / no-show).
 */
const freeProvider = async (session, providerId, extraUpdate = {}) => {
  await ServiceProvider.updateOne(
    { _id: providerId, availabilityStatus: "busy" },
    { $set: { availabilityStatus: "available" } },
    { session },
  );

  if (Object.keys(extraUpdate).length) {
    await ServiceProvider.updateOne({ _id: providerId }, extraUpdate, {
      session,
    });
  }
};

/**
 * Load a booking and work out who the logged-in user is in it.
 */
const loadBookingForUser = async (bookingId, user) => {
  const booking = await Booking.findById(bookingId).populate(
    "provider",
    "user",
  );

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const isCustomer = booking.customer.equals(user._id);
  const isProvider = booking.provider?.user?.equals(user._id) || false;

  return { booking, isCustomer, isProvider };
};

/**
 * Get one booking (customer, provider of the booking, or admin).
 *
 * @route   GET /api/booking/:bookingId
 * @access  Private
 */
export const getBookingById = async (req, res) => {
  const { isCustomer, isProvider } = await loadBookingForUser(
    req.params.bookingId,
    req.user,
  );

  if (!isCustomer && !isProvider && req.user.role !== "admin") {
    throw new ApiError(403, "You are not allowed to view this booking");
  }

  const booking = await Booking.findById(req.params.bookingId)
    .populate("customer", "name phone avatar")
    .populate({
      path: "provider",
      select: "businessName businessPhone location averageRating",
      populate: { path: "user", select: "name avatar" },
    })
    .populate("category", "name");

  res.status(200).json({ success: true, booking });
};

/**
 * Cancel a booking.
 *
 * - Customer: can cancel a pending or in-progress booking.
 * - Provider: can cancel an in-progress booking (e.g. emergency).
 * If the job was in progress, the provider becomes available again.
 *
 * @route   PATCH /api/booking/:bookingId/cancel
 * @access  Private (customer or provider of this booking)
 * @body    reason
 */
export const cancelBooking = async (req, res) => {
  const { booking, isCustomer, isProvider } = await loadBookingForUser(
    req.params.bookingId,
    req.user,
  );

  if (!isCustomer && !isProvider) {
    throw new ApiError(403, "You are not allowed to cancel this booking");
  }

  const allowedFrom = isCustomer ? ["pending", "in_progress"] : ["in_progress"];

  if (!allowedFrom.includes(booking.status)) {
    throw new ApiError(
      400,
      isProvider && booking.status === "pending"
        ? "Use reject for pending bookings"
        : `A ${booking.status} booking cannot be cancelled`,
    );
  }

  const reason = req.body.reason;
  let updated;

  await mongoose.connection.transaction(async (session) => {
    // Status in the filter makes this safe against double requests
    updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      {
        $set: {
          status: "cancelled",
          cancelledBy: isCustomer ? "customer" : "provider",
          reason,
        },
      },
      { returnDocument: "after", runValidators: true, session },
    );

    if (!updated) {
      throw new ApiError(409, "Booking was changed. Please refresh.");
    }

    if (booking.status === "in_progress") {
      await freeProvider(session, booking.provider._id);
    }
  });

  await notify(
    isCustomer ? booking.provider.user : booking.customer,
    "booking_cancelled",
    `${req.user.name} cancelled the booking. Reason: ${reason}`,
    { booking: booking._id },
  );

  res.status(200).json({
    success: true,
    message: "Booking cancelled",
    booking: updated,
  });
};

/**
 * Customer reports the provider did not come.
 *
 * Allowed 1 hour after the provider accepted, if the job is still
 * in progress. The booking becomes "no_show", the provider's public
 * noShowCount goes up, and the provider is freed so the customer
 * can book someone else.
 *
 * @route   PATCH /api/booking/:bookingId/no-show
 * @access  Private (customer of this booking)
 * @body    reason?
 */
export const reportNoShow = async (req, res) => {
  const { booking, isCustomer } = await loadBookingForUser(
    req.params.bookingId,
    req.user,
  );

  if (!isCustomer) {
    throw new ApiError(403, "Only the customer can report a no-show");
  }

  if (booking.status !== "in_progress") {
    throw new ApiError(400, "Only an accepted (in progress) booking can be reported");
  }

  const acceptedAt = booking.acceptedAt || booking.updatedAt;
  if (Date.now() - acceptedAt.getTime() < NO_SHOW_AFTER_MS) {
    const minutesLeft = Math.ceil(
      (NO_SHOW_AFTER_MS - (Date.now() - acceptedAt.getTime())) / 60000,
    );
    throw new ApiError(
      400,
      `Please wait. You can report a no-show in ${minutesLeft} minutes.`,
    );
  }

  const reason = req.body?.reason || "Provider did not show up";
  let updated;

  await mongoose.connection.transaction(async (session) => {
    updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "in_progress" },
      { $set: { status: "no_show", reason } },
      { returnDocument: "after", runValidators: true, session },
    );

    if (!updated) {
      throw new ApiError(409, "Booking was changed. Please refresh.");
    }

    await freeProvider(session, booking.provider._id, {
      $inc: { noShowCount: 1 },
    });
  });

  await notify(
    booking.provider.user,
    "booking_no_show",
    `${req.user.name} reported that you did not show up`,
    { booking: booking._id },
  );

  res.status(200).json({
    success: true,
    message: "No-show reported. You can leave a review and book another provider.",
    booking: updated,
  });
};
