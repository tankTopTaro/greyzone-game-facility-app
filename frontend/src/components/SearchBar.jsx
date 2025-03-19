/* eslint-disable react/prop-types */
import { IconSearch } from "@tabler/icons-react"
import { Button, Dropdown, Form, InputGroup } from "react-bootstrap"

const SearchBar = ({ category, query, setQuery, setCategory, handleSearchClick}) => {
   const formatCategoryText = (text) => {
      return text
         .replace(/_/g, " ") // Replace underscores with spaces
         .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize first letter of each word
   }

  return (
   <div className="d-flex justify-content-center align-items-center">
      <InputGroup className="align-items-center" style={{width: '500px'}}>
         <Dropdown>
            <Dropdown.Toggle 
               className='dropdown-toggle'
               variant="secondary"  
               style={{ width: "120px", whiteSpace: "nowrap" }}
            >
               {formatCategoryText(category)}
            </Dropdown.Toggle>
            <Dropdown.Menu>
               <Dropdown.Item onClick={() => setCategory("email")}>Email</Dropdown.Item>
               <Dropdown.Item onClick={() => setCategory("phone")}>Phone</Dropdown.Item>
               <Dropdown.Item onClick={() => setCategory("last_name")}>Last name</Dropdown.Item>
               <Dropdown.Item onClick={() => setCategory("first_name")}>First name</Dropdown.Item>
            </Dropdown.Menu> 
         </Dropdown>

         <Form.Control
            className="shadow-none border rounded-0"
            type="text"
            placeholder="Search"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
         />
         <Button
            variant="secondary" 
            onClick={handleSearchClick}
         >
            <IconSearch stroke={2} />
         </Button>
      </InputGroup>
   </div>
  )
}

export default SearchBar