/* eslint-disable react/prop-types */
import { Offcanvas } from 'react-bootstrap'

const Alerts = ({ show, onClose }) => {
  return (
    <Offcanvas show={show} onHide={onClose} placement='end'>
      <Offcanvas.Header className='display-6 bg-body-tertiary'>Alerts</Offcanvas.Header>
      <Offcanvas.Body>

      </Offcanvas.Body>
    </Offcanvas>
  )
}

export default Alerts