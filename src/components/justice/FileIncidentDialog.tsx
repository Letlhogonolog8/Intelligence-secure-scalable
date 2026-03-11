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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRegions } from "@/data/aegisData";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface FileIncidentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FileIncidentDialog: React.FC<FileIncidentDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { data: regions = [] } = useRegions();
  const [formData, setFormData] = useState({
    region_id: "",
    incident_type: "",
    severity: "moderate",
    description: "",
    incident_date: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFileIncident = async () => {
    if (!formData.region_id || !formData.incident_type) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("incidents")
        .insert({
          region_id: formData.region_id,
          incident_type: formData.incident_type,
          severity: formData.severity,
          description: formData.description,
          incident_date: new Date(formData.incident_date).toISOString(),
          anonymous: false,
        });

      if (error) throw error;

      toast({
        title: "Incident Filed",
        description: "The incident has been recorded and risk models will be updated.",
      });
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        title: "Filing Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-slate-950 text-slate-100 border-slate-800">
        <DialogHeader>
          <DialogTitle>File New Incident</DialogTitle>
          <DialogDescription className="text-slate-400">
            Record a field incident directly to the command system.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="region">Region</Label>
              <Select
                value={formData.region_id}
                onValueChange={(val) => setFormData(prev => ({ ...prev, region_id: val }))}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}, {region.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Incident Type</Label>
              <Select
                value={formData.incident_type}
                onValueChange={(val) => setFormData(prev => ({ ...prev, incident_type: val }))}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="sexual">Sexual</SelectItem>
                  <SelectItem value="emotional">Emotional</SelectItem>
                  <SelectItem value="economic">Economic</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="severity">Severity Level</Label>
              <Select
                value={formData.severity}
                onValueChange={(val) => setFormData(prev => ({ ...prev, severity: val }))}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Date of Incident</Label>
              <Input 
                type="date" 
                value={formData.incident_date}
                onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Details</Label>
            <Textarea 
              placeholder="Describe the incident details..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-slate-900 border-slate-800 text-slate-100 min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleFileIncident} disabled={!formData.region_id || !formData.incident_type || isSubmitting}>
            {isSubmitting ? "Filing..." : "Record Incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FileIncidentDialog;
