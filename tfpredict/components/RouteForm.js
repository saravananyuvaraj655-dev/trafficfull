import React from "react";
import { Box, TextField, Button, Autocomplete } from "@mui/material";

const RouteForm = ({ start, end, setStart, setEnd, onSubmit, suggestions = [], onSearchChange }) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Start Input */}
      <Autocomplete
        freeSolo
        options={suggestions}
        onInputChange={(e, val) => onSearchChange(val)} // 👈 always trigger suggestions
        onChange={(e, val) => setStart(val)}
        value={start}
        renderInput={(params) => <TextField {...params} label="Start Location" />}
      />

      {/* End Input */}
      <Autocomplete
        freeSolo
        options={suggestions}
        onInputChange={(e, val) => onSearchChange(val)}
        onChange={(e, val) => setEnd(val)}
        value={end}
        renderInput={(params) => <TextField {...params} label="End Location" />}
      />

      {/* Button calls parent best-route fetch */}
      <Button variant="contained" onClick={onSubmit}>
        Find Best Route
      </Button>
    </Box>
  );
};

export default RouteForm;
