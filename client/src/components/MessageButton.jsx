import { Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import api, { getErrorMessage } from "../api/axios";

/** Opens (or creates) the chat for a booking and goes to it. */
export default function MessageButton({ bookingId, className = "btn-outline", label = "Message" }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const res = await api.post("/chats", { bookingId });
      navigate(`/messages/${res.data.conversation._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} onClick={open} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      {label}
    </button>
  );
}
