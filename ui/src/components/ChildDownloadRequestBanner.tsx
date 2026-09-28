import { useChildDownloadRequests } from "../useChildDownloadRequests";
import ChildDownloadRequestCard from "./ChildDownloadRequestCard";
import "./ChildProfiles.css";

/**
 * Home-feed fallback for download requests. Parents who keep the child-activity
 * shortcut on screen approve requests there; this is where the same requests
 * land for everyone who turned that shortcut off — the surface the request
 * notification points at.
 */
export default function ChildDownloadRequestBanner() {
  const { requests, monitorVisible, resolve } = useChildDownloadRequests();
  if (monitorVisible || requests.length === 0) return null;
  return (
    <div className="child-request-banner">
      {requests.map((request) => (
        <ChildDownloadRequestCard key={request.id} request={request} resolve={resolve} />
      ))}
    </div>
  );
}
