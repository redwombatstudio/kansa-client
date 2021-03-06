import { Map } from 'immutable'
import Dialog from 'material-ui/Dialog'
import FlatButton from 'material-ui/FlatButton'
import PropTypes from 'prop-types'
import React, { PureComponent } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { connect } from 'react-redux'

import printBadge from '../printBadge'
import { CommonFields, PaperPubsFields } from './form'
import MemberLog from './MemberLog'
import NewInvoice from './NewInvoice'
import Upgrade from './Upgrade'

export const defaultMember = Map({
  legal_name: '',
  email: '',
  badge_name: '',
  badge_subtitle: '',
  public_first_name: '',
  public_last_name: '',
  country: '',
  state: '',
  city: ''
})

export const memberFields = [
  'membership', 'legal_name', 'email', 'badge_name', 'badge_subtitle',
  'public_first_name', 'public_last_name', 'country', 'state', 'city',
  'paper_pubs'
]

export const membershipTypes = [
  'NonMember', 'Exhibitor', 'Helper', 'Supporter', 'KidInTow', 'Child', 'Youth',
  'FirstWorldcon', 'Adult'
]

export const emptyPaperPubsMap = Map({ name: '', address: '', country: '' })

export const paperPubsIsValid = (pp) => (
  !pp || pp.get('name') && pp.get('address') && pp.get('country')
)

export const memberIsValid = (member) => (
  Map.isMap(member) &&
  member.get('legal_name', false) &&
  member.get('email', false) &&
  paperPubsIsValid(member.get('paper_pubs'))
)

class Member extends PureComponent {
  static propTypes = {
    api: PropTypes.object.isRequired,
    handleClose: PropTypes.func.isRequired,
    locked: PropTypes.bool.isRequired,
    member: ImmutablePropTypes.mapContains({
      id: PropTypes.number,
      legal_name: PropTypes.string,
      email: PropTypes.string,
      badge_name: PropTypes.string,
      badge_subtitle: PropTypes.string,
      public_first_name: PropTypes.string,
      public_last_name: PropTypes.string,
      country: PropTypes.string,
      state: PropTypes.string,
      city: PropTypes.string,
      paper_pubs: ImmutablePropTypes.mapContains({
        name: PropTypes.string.isRequired,
        address: PropTypes.string.isRequired,
        country: PropTypes.string.isRequired
      })
    }),
    printer: PropTypes.string,
    setMember: PropTypes.func.isRequired,
    showMessage: PropTypes.func.isRequired
  }

  state = {
    member: Map(),
    sent: false
  }

  componentWillReceiveProps ({ api, member, setMember }) {
    if (member && !member.equals(this.props.member)) {
      this.setState({
        member: defaultMember.merge(member),
        sent: false
      })
      if (!this.props.member) {
        api.GET(`people/${member.get('id')}`).then(setMember)
      }
    }
  }

  get actions () {
    const { api, handleClose, locked, member, printer, showMessage } = this.props
    const { sent } = this.state
    const hasChanges = this.changes.size > 0
    const id = member.get('id')
    const membership = member.get('membership')

    const actions = [
      <FlatButton key='close' label='Close' onClick={handleClose} />,
      <FlatButton key='ok'
        disabled={sent || !hasChanges || !this.valid}
        label={sent ? 'Working...' : 'Apply'}
        onClick={() => this.save().then(handleClose)}
      />
    ]

    if (!locked) {
      const email = member.get('email')
      const legal_name = member.get('legal_name')
      const paper_pubs = member.get('paper_pubs')
      actions.unshift(
        <MemberLog key='log'
          getLog={() => api.GET(`people/${id}/log`)}
          id={id}
        >
          <FlatButton label='View log' style={{ float: 'left' }} />
        </MemberLog>,

        <Upgrade key='upgrade'
          membership={membership}
          paper_pubs={paper_pubs}
          name={`${legal_name} <${email}>`}
          upgrade={res => api.POST(`people/${id}/upgrade`, res)
            .then(() => showMessage(`${legal_name} upgraded`))
          }
        >
          <FlatButton label='Upgrade' style={{ float: 'left' }} />
        </Upgrade>,

        <NewInvoice key='invoice'
          onSubmit={invoice => api.POST(`purchase/invoice`, {
            email,
            items: [invoice]
          }).then(() => showMessage(`Invoice created for ${legal_name}`))}
          person={member}
        >
          <FlatButton label='New invoice' style={{ float: 'left' }} />
        </NewInvoice>
      )
    }

    const daypass = member.get('daypass')
    if (printer && membership !== 'Supporter' && (membership !== 'NonMember' || daypass)) {
      let label = daypass ? 'Claim daypass' : 'Print badge'
      if (member.get('badge_print_time')) label = 'Re-' + label
      if (hasChanges) label = 'Save & ' + label
      actions.unshift(
        <FlatButton
          disabled={sent || !this.valid}
          label={label}
          onClick={() => this.handleBadgePrint()
            .then(() => showMessage(`${daypass ? 'Daypass claimed' : 'Badge printed'} for ${member.get('preferred_name')}`))
          }
          style={{ float: 'left' }}
        />
      )
    }

    return actions
  }

  get changes () {
    const m0 = this.props.member
    return this.state.member.filter((value, key) => {
      const v0 = m0.get(key, '')
      return value && value.equals ? !value.equals(v0) : value !== v0
    })
  }

  get valid () {
    return memberIsValid(this.state.member)
  }

  handleBadgePrint = () => {
    const { api, handleClose, member, printer } = this.props
    const hasChanges = this.changes.size > 0
    const prev = member.get('badge_print_time')
    const print = !prev || window.confirm([
      'Are you sure?', '',
      member.get('daypass') ? 'Daypass was already claimed at:' : 'Badge was already printed at:',
      new Date(prev).toLocaleString('en-GB', {
        hour12: false,
        weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric'
      })
    ].join('\n'))
    if (!print) return Promise.reject()
    const [pu, pn] = printer.split('#')
    return (member.get('daypass') ? Promise.resolve() : printBadge(pu, pn, this.state.member))
      .catch(err => {
        console.error('Badge print failed!', err)
        window.alert('Badge print failed! ' + (err.message || err.statusText || err.status))
        throw err
      })
      .then(() => api.POST(`people/${member.get('id')}/print`))
      .then(() => hasChanges ? this.save() : null)
      .then(handleClose)
  }

  save () {
    const { api, member, showMessage } = this.props
    this.setState({ sent: true })
    return api.POST(`people/${member.get('id')}`, this.changes.toJS())
      .then(() => showMessage(`Data saved for ${member.get('preferred_name')}`))
      .catch(err => {
        console.error('Member save failed!', err)
        window.alert('Member save failed! ' + err.message)
        throw err
      })
  }

  render () {
    const { handleClose, member } = this.props
    if (!member) return null
    const membership = member.get('membership', 'NonMember')
    const formProps = {
      getDefaultValue: path => member.getIn(path, ''),
      getValue: path => this.state.member.getIn(path, null),
      onChange: (path, value) => this.setState({ member: this.state.member.setIn(path, value) })
    }

    return <Dialog
      actions={this.actions}
      title={<div title={'ID: ' + member.get('id')}>
        <div style={{
          color: 'rgba(0, 0, 0, 0.3)',
          float: 'right',
          fontSize: 11,
          fontStyle: 'italic',
          lineHeight: 'normal',
          textAlign: 'right'
        }}>
          Last modified<br />
          { member.get('last_modified') }
        </div>
        {
          membership === 'NonMember' ? 'Non-member'
            : /^DP/.test(membership) ? membership.replace(/^DP/, 'Day pass:')
            : `Member #${member.get('member_number')} (${membership})`
        }
      </div>}
      open
      autoScrollBodyContent
      bodyClassName='memberDialog'
      onRequestClose={handleClose}
    >
      <CommonFields {...formProps} />
      <br />
      <PaperPubsFields {...formProps} />
    </Dialog>
  }
}

export default connect(
  ({ registration }) => ({
    locked: registration.get('locked') || false,
    printer: registration.get('printer')
  }), (dispatch) => ({
    setMember: (data) => dispatch({ type: 'SET PERSON', data }),
    showMessage: (message) => dispatch({ type: 'SET MESSAGE', message })
  })
)(Member)
