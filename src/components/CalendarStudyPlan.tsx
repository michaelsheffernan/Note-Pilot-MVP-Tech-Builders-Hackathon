import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, X, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface StudyDay {
  day: number;
  date: string;
  topics: string[];
  estimated_minutes: number;
}

export function CalendarStudyPlan({ plan, completed, onToggleComplete, onEditDay, onDeleteDay }: {
  plan: StudyDay[];
  completed: Set<number>;
  onToggleComplete: (day: number) => void;
  onEditDay?: (day: number, updates: { topics: string[]; estimated_minutes: number }) => void;
  onDeleteDay?: (day: number) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<StudyDay | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTopics, setEditTopics] = useState("");
  const [editMinutes, setEditMinutes] = useState(0);

  const dateMap = useMemo(() => {
    const map = new Map<string, StudyDay>();
    plan.forEach((d) => map.set(d.date, d));
    return map;
  }, [plan]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { days.push(d); d = addDays(d, 1); }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const openDayDialog = (studyDay: StudyDay) => {
    setSelectedDay(studyDay);
    setEditing(false);
    setEditTopics(studyDay.topics.join(", "));
    setEditMinutes(studyDay.estimated_minutes);
    setDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedDay || !onEditDay) return;
    const topics = editTopics.split(",").map((t) => t.trim()).filter(Boolean);
    onEditDay(selectedDay.day, { topics, estimated_minutes: editMinutes });
    setEditing(false);
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!selectedDay || !onDeleteDay) return;
    onDeleteDay(selectedDay.day);
    setDialogOpen(false);
    setSelectedDay(null);
  };

  const isDone = selectedDay ? completed.has(selectedDay.day) : false;

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 bg-secondary/50">
          {weekDays.map((wd) => (
            <div key={wd} className="py-2 text-center text-xs font-medium text-muted-foreground">{wd}</div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-t border-border">
            {week.map((date, di) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const studyDay = dateMap.get(dateStr);
              const inMonth = isSameMonth(date, currentMonth);
              const today = isToday(date);
              const done = studyDay && completed.has(studyDay.day);

              return (
                <button
                  key={di}
                  onClick={() => studyDay && openDayDialog(studyDay)}
                  className={`relative min-h-[72px] border-r border-border p-1.5 text-left transition-all duration-150 last:border-r-0
                    ${!inMonth ? "bg-secondary/20" : "hover:bg-secondary/40 cursor-pointer"}
                    ${today ? "bg-primary/5" : ""}
                  `}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
                    ${today ? "bg-primary text-primary-foreground font-bold" : inMonth ? "text-foreground" : "text-muted-foreground/40"}
                  `}>
                    {format(date, "d")}
                  </span>

                  {studyDay && inMonth && (
                    <div className="mt-0.5 space-y-0.5">
                      {studyDay.topics.slice(0, 2).map((topic, ti) => (
                        <div key={ti} className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium
                          ${done ? "bg-primary/10 text-primary/50 line-through" : "bg-primary/10 text-primary"}
                        `}>{topic}</div>
                      ))}
                      {studyDay.topics.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{studyDay.topics.length - 2} more</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Day detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>Day {selectedDay.day}</span>
                    <span className="text-sm font-normal text-muted-foreground">{selectedDay.date}</span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {!editing ? (
                <div className="space-y-5">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isDone ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {isDone ? "Completed" : "Pending"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {selectedDay.estimated_minutes} min
                    </span>
                  </div>

                  {/* Topics */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Topics</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDay.topics.map((topic, i) => (
                        <span key={i} className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{topic}</span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant={isDone ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => onToggleComplete(selectedDay.day)}
                    >
                      {isDone ? "Mark Incomplete" : "Mark Complete"}
                    </Button>
                    {onEditDay && (
                      <Button variant="outline" onClick={() => {
                        setEditTopics(selectedDay.topics.join(", "));
                        setEditMinutes(selectedDay.estimated_minutes);
                        setEditing(true);
                      }}>
                        Edit
                      </Button>
                    )}
                    {onDeleteDay && (
                      <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Topics (comma-separated)</Label>
                    <Input value={editTopics} onChange={(e) => setEditTopics(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Estimated Minutes</Label>
                    <Input type="number" value={editMinutes} onChange={(e) => setEditMinutes(Number(e.target.value))} className="mt-1" min={5} max={480} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} className="flex-1">Save</Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
