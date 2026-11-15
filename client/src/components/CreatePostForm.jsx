import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/axios";
import { checkImageFile, MAX_IMAGE_MB } from "../utils/format";

const MAX_PER_SIDE = 2;

/** One upload box: "Before" or "After", up to 2 photos. */
function PhotoSide({ title, hint, files, setFiles, required }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    const valid = [];
    for (const file of picked) {
      const problem = checkImageFile(file);
      if (problem) toast.error(problem);
      else valid.push(file);
    }
    const next = [...files, ...valid];
    if (next.length > MAX_PER_SIDE) toast.error(`Up to ${MAX_PER_SIDE} photos for "${title}"`);
    setFiles(next.slice(0, MAX_PER_SIDE));
  };

  return (
    <div className="rounded-[22px] border border-dashed border-line p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider">
          {title} {required && <span className="text-accent">*</span>}
        </span>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {previews.map((p, i) => (
          <div key={p.url} className="relative aspect-square">
            <img src={p.url} alt="" className="h-full w-full rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label={`Remove ${title} photo`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {files.length < MAX_PER_SIDE && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-surface-2 text-muted transition hover:text-accent">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs font-medium">Add photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={add} />
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Provider posts their own work: before/after photos + a short story.
 * Only providers see this form; customers take part through comments.
 */
export default function CreatePostForm({ placeholder, onCreated }) {
  const [text, setText] = useState("");
  const [before, setBefore] = useState([]);
  const [after, setAfter] = useState([]);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (after.length === 0) return toast.error("Add at least one photo of the finished work");
    if (text.trim().length < 3) return toast.error("Please write a few words about the job");

    const form = new FormData();
    form.append("text", text.trim());
    before.forEach((f) => form.append("before", f));
    after.forEach((f) => form.append("after", f));

    setSaving(true);
    try {
      const res = await api.post("/posts", form);
      toast.success("Your work is posted!");
      setText("");
      setBefore([]);
      setAfter([]);
      onCreated?.(res.data.post);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5">
      <div>
        <p className="font-semibold">Post your work</p>
        <p className="text-sm text-muted">Before/after photos win customers' trust. Customers can comment and you can reply.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoSide title="Before" hint="optional" files={before} setFiles={setBefore} />
        <PhotoSide title="After" hint={`max ${MAX_IMAGE_MB} MB each`} files={after} setFiles={setAfter} required />
      </div>

      <textarea
        className="input min-h-24 resize-y"
        placeholder={placeholder}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        aria-label="About this job"
      />

      <button className="btn-primary h-12 w-full sm:w-auto sm:px-8" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Post work
      </button>
    </form>
  );
}
