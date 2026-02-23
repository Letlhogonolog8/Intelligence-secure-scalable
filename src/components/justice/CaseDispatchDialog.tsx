import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePoliceOfficers, JusticeCase } from "@/data/aegisData";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface CaseDispatchDialogProps {
  caseItem: JusticeCase | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CaseDispatchDialog: React.FC<CaseDispatchDialogProps> = ({
  caseItem,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { data: officers = [], isLoading: officersLoading } = usePoliceOfficers();
  const [selectedOfficer, setSelectedOfficer] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleDispatch = async () => {
    if (!caseItem || !selectedOfficer) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("justice_cases")
        .update({
          assigned_to: selectedOfficer,
          status: "investigation",
          stage: "investigation",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseItem.id);

      if (error) throw error;

      toast({
        title: "Case Dispatched",
        description: `Case #${caseItem.caseNumber} has been assigned and moved to investigation.`,
      });
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        title: "Dispatch Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-slate-950 text-slate-100 border-slate-800">
        <DialogHeader>
          <DialogTitle>Dispatch Case #{caseItem?.caseNumber}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Assign an officer to begin the investigation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="officer">Responding Officer</Label>
            <Select
              value={selectedOfficer}
              onValueChange={setSelectedOfficer}
              disabled={officersLoading || isSubmitting}
            >
              <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-100">
                <SelectValue placeholder="Select an officer" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                {officers.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id}>
                    {officer.fullName || "Unnamed Officer"}
                  </SelectItem>
                ))}
                {officers.length === 0 && !officersLoading && (
                  <SelectItem value="none" disabled>No officers available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleDispatch} disabled={!selectedOfficer || isSubmitting}>
            {isSubmitting ? "Dispatching..." : "Confirm Dispatch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CaseDispatchDialog;
