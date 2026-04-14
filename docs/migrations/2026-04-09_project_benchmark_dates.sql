alter table public.projects add column if not exists turnover_date date;
alter table public.projects add column if not exists substantial_completion_date date;
alter table public.projects add column if not exists project_completion_date date;

comment on column public.projects.turnover_date is 'Date when the project is turned over to the owner/operator';
comment on column public.projects.substantial_completion_date is 'Date when work is substantially complete (punch list items may remain)';
comment on column public.projects.project_completion_date is 'Final completion date including all punch list close-outs';

notify pgrst, 'reload schema';
